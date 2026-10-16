package app.oceanx.pos;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** OceanX Admin: the background check for payments waiting (declared only in the admin app's manifest). */
public class AlertsService extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            Alerts.check(getApplicationContext());
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true; // try again later
    }
}
