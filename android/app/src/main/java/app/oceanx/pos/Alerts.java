package app.oceanx.pos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * OceanX Admin only: payment notifications while the app is closed. The phone keeps a read-only key
 * (it can only ask how many payments wait) and asks the server about every 15 minutes; when a new payment
 * is waiting it shows a notification. Approving still happens in the app, signed in.
 */
final class Alerts {
    static final boolean SUPPORTED = "admin".equals(BuildConfig.FLAVOR);
    private static final String PREFS = "alerts";
    private static final String KEY = "key";
    private static final String LAST_ID = "last_id";
    private static final String CHANNEL = "payments";
    private static final int JOB_ID = 4201;
    private static final int NOTIFICATION_ID = 1;
    private static final long EVERY_MS = 15 * 60 * 1000L; // the shortest repeat Android allows

    private Alerts() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isOn(Context c) {
        return SUPPORTED && prefs(c).getString(KEY, null) != null;
    }

    static void enable(Context c, String key) {
        if (!SUPPORTED || key == null || key.length() < 20) return;
        prefs(c).edit().putString(KEY, key).remove(LAST_ID).apply();
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(c, AlertsService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(EVERY_MS)
                .setPersisted(true) // keeps checking after the phone restarts
                .build();
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.schedule(job);
    }

    static void disable(Context c) {
        prefs(c).edit().clear().apply();
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB_ID);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
    }

    /** One check (runs in the background, never on the main thread). */
    static void check(Context c) {
        String key = prefs(c).getString(KEY, null);
        if (key == null) return;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(BuildConfig.SERVER_URL + "/api/superadmin/alerts/pending").openConnection();
            con.setConnectTimeout(15000);
            con.setReadTimeout(15000);
            con.setRequestProperty("x-alert-key", key);
            con.setRequestProperty("accept", "application/json");
            con.setRequestProperty("user-agent", "OceanXAndroid/" + BuildConfig.VERSION_NAME + " alerts");
            int status = con.getResponseCode();
            if (status == 401) { // turned off on the server (or the account): stop checking
                disable(c);
                return;
            }
            if (status != 200) return;
            JSONObject body = new JSONObject(read(con.getInputStream()));
            int pending = body.optInt("pending", 0);
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (pending == 0 || body.isNull("newest")) {
                nm.cancel(NOTIFICATION_ID);
                return;
            }
            JSONObject newest = body.getJSONObject("newest");
            String id = newest.optString("id");
            if (id.equals(prefs(c).getString(LAST_ID, ""))) return; // already told about this one
            prefs(c).edit().putString(LAST_ID, id).apply();
            String text = newest.optString("businessName") + " · " + productName(newest.optString("product"))
                    + " · " + money(newest.optLong("amount"), newest.optString("currency"));
            if (pending > 1) text += " (" + pending + " waiting)";
            notify(c, nm, pending == 1 ? "Payment waiting for approval" : pending + " payments waiting for approval", text);
        } catch (Exception ignored) {
            // No internet or a slow answer: the next check tries again.
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static void notify(Context c, NotificationManager nm, String title, String text) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Payments to approve", NotificationManager.IMPORTANCE_HIGH));
        }
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("openPayments", true);
        PendingIntent tap = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.stat_notify_more)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(tap)
                .setAutoCancel(true);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        nm.notify(NOTIFICATION_ID, b.build());
    }

    private static String productName(String p) {
        switch (p) {
            case "gravity": return "Gravity";
            case "flow": return "Gravity Flow";
            case "budget": return "Gravity Budget";
            default: return "OceanX POS";
        }
    }

    private static String money(long minor, String currency) {
        return currency + " " + String.format(Locale.US, "%,.2f", minor / 100.0);
    }

    private static String read(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }
}
