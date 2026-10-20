package com.madeyourdreambigger.smartroutine;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class AlarmRingingActivity extends Activity {
    private String alarmId = "";
    private String alarmLabel = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        alarmId = getIntent().getStringExtra(AlarmScheduler.EXTRA_ID);
        alarmLabel = getIntent().getStringExtra(AlarmScheduler.EXTRA_LABEL);
        if (alarmId == null) alarmId = "";
        if (alarmLabel == null) alarmLabel = "";

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(padding, padding, padding, padding);
        TextView title = new TextView(this);
        title.setText(R.string.alarm_ringing_title);
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);
        TextView label = new TextView(this);
        label.setText(alarmLabel.isEmpty() ? getString(R.string.alarm_notification_body) : alarmLabel);
        label.setTextSize(24);
        label.setGravity(Gravity.CENTER);
        label.setTextColor(Color.rgb(142, 93, 0));
        label.setTypeface(null, Typeface.BOLD);
        label.setPadding(16, 12, 16, 12);
        layout.addView(label);
        Button stop = new Button(this);
        stop.setText(R.string.alarm_stop);
        stop.setOnClickListener(view -> finishAlarm(AlarmRingingService.ACTION_STOP));
        layout.addView(stop);
        Button snooze = new Button(this);
        snooze.setText(R.string.alarm_snooze);
        snooze.setOnClickListener(view -> finishAlarm(AlarmRingingService.ACTION_SNOOZE));
        layout.addView(snooze);
        setContentView(layout);
    }

    private void finishAlarm(String action) {
        Intent intent = new Intent(this, AlarmRingingService.class)
            .setAction(action)
            .putExtra(AlarmScheduler.EXTRA_ID, alarmId)
            .putExtra(AlarmScheduler.EXTRA_LABEL, alarmLabel)
            .putExtra(AlarmScheduler.EXTRA_LANGUAGE, getIntent().getStringExtra(AlarmScheduler.EXTRA_LANGUAGE));
        // This activity is visible to the user, so a normal service start is allowed.
        // Do not use startForegroundService for STOP/SNOOZE: those actions exit before
        // AlarmRingingService calls startForeground(), which can trigger an Android 8+
        // foreground-service timeout crash.
        startService(intent);
        finish();
    }
}
