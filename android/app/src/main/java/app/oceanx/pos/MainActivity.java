package app.oceanx.pos;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * One shell, two apps (see build.gradle flavors):
 *  - OceanX POS for tablets: the live POS full-screen and sideways, screen kept on during service;
 *  - Gravity for phones: quotations & invoices as a normal phone app (status bar shown, turns with the phone).
 * Both add the few things a web page cannot do on its own inside an app — printing, saving PDFs, choosing
 * photos and downloading exports.
 */
public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 1;
    private static final String HOME = BuildConfig.SERVER_URL;
    /** POS: opens on the POS (or the kitchen display for kitchen staff). Gravity: opens on its home. */
    private static final String START = HOME + BuildConfig.START_PATH;
    private static final boolean PHONE = BuildConfig.PHONE_APP;
    private static final String HOST = Uri.parse(HOME).getHost();

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    /**
     * POS app on a phone, signed in to a takeaway shop: a normal upright phone app with the whole system
     * (the page says so through the bridge). Cafés, restaurants and shops keep the sideways tablet POS.
     */
    private boolean phoneTill;
    private FrameLayout root;

    @Override
    @SuppressWarnings("deprecation")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // On a phone the app starts upright; it turns sideways only once the page says it is not a takeaway shop.
        phoneTill = !PHONE && isPhone() && getPreferences(MODE_PRIVATE).getBoolean("phoneTill", true);
        // A till or kitchen screen should stay on during service (a phone app lets the screen sleep).
        if (!PHONE) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (!PHONE && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        web = new WebView(this);
        web.setBackgroundColor(PHONE ? Color.WHITE : Color.BLACK);
        // Phones (and the POS app as a takeaway shop's phone app) keep the status and navigation bars: the page
        // sits between them and above the keyboard. The app draws edge to edge on every Android version
        // (15 does it anyway) and adds that space here. The tablet POS is full screen and needs none.
        root = new FrameLayout(this);
        root.setBackgroundColor(PHONE || phoneTill ? Color.parseColor("#03213a") : Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (!PHONE && !phoneTill) {
                v.setPadding(0, 0, 0, 0);
                return insets;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            // Used up here: the page must not add the same space again (it would make the bottom bar twice as tall).
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
        });
        setContentView(root);
        if (PHONE || phoneTill) drawEdgeToEdge();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false); // print pages open in the same screen; Close goes back
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Follow the page's layout width (tablets lay the POS out at 1280 and scale to fit),
        // and the tablet's font-size setting does not blow the POS up.
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        // Phones: pinch to zoom (e.g. to read an A4 invoice shown smaller to fit the screen). The POS tablet stays fixed.
        s.setSupportZoom(PHONE);
        s.setBuiltInZoomControls(PHONE);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " OceanXAndroid/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Bridge(), "OceanXAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> download(url, userAgent, contentDisposition, mimeType));

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START);
    }

    /** Tapping a payment notification (OceanX Admin): show the payments screen, fresh. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getBooleanExtra("openPayments", false)) web.loadUrl(START);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && !PHONE && !phoneTill) goFullScreen();
    }

    /** A phone (short side under 600 dp), not a tablet. */
    private boolean isPhone() {
        return getResources().getConfiguration().smallestScreenWidthDp < 600;
    }

    /** Switches between the sideways tablet POS and the upright phone app for a takeaway shop. */
    private void setPhoneTill(boolean on) {
        boolean want = on && !PHONE && isPhone();
        getPreferences(MODE_PRIVATE).edit().putBoolean("phoneTill", want).apply();
        if (want == phoneTill) return;
        phoneTill = want;
        root.setBackgroundColor(want ? Color.parseColor("#03213a") : Color.BLACK);
        if (want) showBars();
        else goFullScreen();
        root.requestApplyInsets();
        orientationFor(web.getUrl());
    }

    /** The status bar and navigation buttons back, as in any phone app. */
    @SuppressWarnings("deprecation")
    private void showBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        }
        drawEdgeToEdge();
    }

    /** Phones: the app draws under the bars on every Android version and pads itself (no double spacing). */
    @SuppressWarnings("deprecation")
    private void drawEdgeToEdge() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    /** Full screen: no status bar or navigation buttons; a swipe from the edge shows them for a moment. */
    @SuppressWarnings("deprecation")
    private void goFullScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    /** Sign-in pages turn any way; once signed in the app stays sideways (landscape) for the POS. */
    private void orientationFor(String url) {
        if (PHONE) return; // the phone app turns with the phone
        if (phoneTill) {
            // Upright or sideways, as the phone is held (the phone's rotation lock still applies).
            if (getRequestedOrientation() != ActivityInfo.SCREEN_ORIENTATION_FULL_USER) setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
            return;
        }
        String path = url == null ? "" : Uri.parse(url).getPath();
        if (path == null) path = "";
        boolean signIn = path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password") || path.startsWith("/reset-password");
        int want = signIn ? ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED : ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        if (getRequestedOrientation() != want) setRequestedOrientation(want);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush(); // keep the sign-in when the tablet sleeps
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** Called from the web page (window.OceanXAndroid). */
    private class Bridge {
        @JavascriptInterface
        public void print(String jobName) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                String name = jobName == null || jobName.isEmpty() ? getString(R.string.app_name) : jobName;
                PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
                pm.print(name, web.createPrintDocumentAdapter(name), attrs);
            });
        }

        /** OceanX Admin: turn payment notifications on with the read-only key from the server. */
        @JavascriptInterface
        public void enableAlerts(String key) {
            if (!Alerts.SUPPORTED) return;
            Alerts.enable(getApplicationContext(), key);
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(() -> requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, 2));
            }
        }

        /** POS app: the signed-in business is a takeaway shop (true) or not; on a phone that picks the phone app. */
        @JavascriptInterface
        public void phoneTill(boolean takeaway) {
            runOnUiThread(() -> setPhoneTill(takeaway));
        }

        @JavascriptInterface
        public void disableAlerts() {
            Alerts.disable(getApplicationContext());
        }

        @JavascriptInterface
        public boolean alertsOn() {
            return Alerts.isOn(getApplicationContext());
        }

        @JavascriptInterface
        public void saveFile(String base64, String filename, String mime) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                Uri uri = saveToDownloads(data, safeName(filename), mime);
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, getString(R.string.app_name) + ": " + safeName(filename), Toast.LENGTH_SHORT).show();
                    if (uri != null) openFile(uri, mime);
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not save the file", Toast.LENGTH_LONG).show());
            }
        }
    }

    private static String safeName(String name) {
        String n = name == null ? "file" : name.replaceAll("[\\\\/:*?\"<>|]", "-");
        return n.isEmpty() ? "file" : n;
    }

    private Uri saveToDownloads(byte[] data, String name, String mime) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver r = getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, name);
            v.put(MediaStore.Downloads.MIME_TYPE, mime);
            Uri uri = r.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IllegalStateException("no uri");
            try (OutputStream out = r.openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("no stream");
                out.write(data);
            }
            return uri;
        }
        // Older Android: the app's own Downloads folder (no storage permission needed).
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) dir = getFilesDir();
        File f = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(data);
        }
        return null;
    }

    private void openFile(Uri uri, String mime) {
        Intent view = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivity(view);
        } catch (ActivityNotFoundException ignored) {
            // Saved in Downloads; nothing installed to open it.
        }
    }

    /** CSV exports and other server downloads, sent with the signed-in session. */
    private void download(String url, String userAgent, String contentDisposition, String mimeType) {
        try {
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
            req.addRequestHeader("User-Agent", userAgent);
            req.setMimeType(mimeType);
            req.setTitle(name);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
            Toast.makeText(this, name, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Could not download the file", Toast.LENGTH_LONG).show();
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme();
            // The system itself stays in the app; anything else (WhatsApp, phone, email, maps) opens outside.
            if (("https".equals(scheme) || "http".equals(scheme)) && HOST != null && HOST.equalsIgnoreCase(uri.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                // nothing can open it
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (url != null && url.startsWith(HOME)) orientationFor(url);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            super.doUpdateVisitedHistory(view, url, isReload);
            if (url != null && url.startsWith(HOME)) orientationFor(url);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                    + "<body style='margin:0;background:" + (PHONE ? "#03213a" : "#070809") + ";color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
                    + "<div><h2>No internet connection</h2><p style='color:#9fb0b8'>Check Wi-Fi or mobile data, then try again.</p>"
                    + "<button onclick=\"location.href='" + START + "'\" style='margin-top:16px;padding:14px 28px;border-radius:999px;border:0;font-size:16px;font-weight:bold'>Try again</button></div></body></html>";
            view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                startActivityForResult(params.createIntent(), FILE_CHOOSER);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.setVisibility(View.GONE);
            web.destroy();
        }
        super.onDestroy();
    }
}
