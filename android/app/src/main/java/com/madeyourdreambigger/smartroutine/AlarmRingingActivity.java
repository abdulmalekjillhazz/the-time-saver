package com.madeyourdreambigger.smartroutine;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmRingingActivity extends Activity {
    private String alarmId = "";
    private String alarmLabel = "";

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        );
    }

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
        String language = getIntent().getStringExtra(AlarmScheduler.EXTRA_LANGUAGE);
        boolean isBn = "bn".equalsIgnoreCase(language);

        if (alarmId == null) alarmId = "";
        if (alarmLabel == null) alarmLabel = "";

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#070D1E"));
        int padH = dp(24);
        int padV = dp(36);
        root.setPadding(padH, padV, padH, padV);

        View topSpacer = new View(this);
        root.addView(topSpacer, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.0f
        ));

        TextView timeView = new TextView(this);
        String currentTime = new SimpleDateFormat("hh:mm a", Locale.getDefault()).format(new Date());
        timeView.setText(currentTime);
        timeView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 46);
        timeView.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        timeView.setTextColor(Color.parseColor("#FFFFFF"));
        timeView.setGravity(Gravity.CENTER);
        root.addView(timeView);

        TextView ringingSubtitle = new TextView(this);
        ringingSubtitle.setText(isBn ? "🔔 অ্যালার্ম বাজছে" : "🔔 Alarm is ringing");
        ringingSubtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        ringingSubtitle.setTextColor(Color.parseColor("#E2B341"));
        ringingSubtitle.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        ringingSubtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subParams.setMargins(0, dp(6), 0, dp(24));
        root.addView(ringingSubtitle, subParams);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setCornerRadius(dp(20));
        cardBg.setColor(Color.parseColor("#111C38"));
        cardBg.setStroke(dp(2), Color.parseColor("#E2B341"));
        card.setBackground(cardBg);
        card.setPadding(dp(22), dp(20), dp(22), dp(20));

        TextView nameLabel = new TextView(this);
        String displayName = alarmLabel.isEmpty()
            ? (isBn ? "আপনার রুটিন অ্যালার্ম" : "Smart Routine Alarm")
            : alarmLabel;
        nameLabel.setText(displayName);
        nameLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        nameLabel.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        nameLabel.setTextColor(Color.parseColor("#FFFFFF"));
        nameLabel.setGravity(Gravity.CENTER);
        nameLabel.setLineSpacing(dp(4), 1.15f);
        card.addView(nameLabel);

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(28));
        root.addView(card, cardParams);

        View midSpacer = new View(this);
        root.addView(midSpacer, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.2f
        ));

        LinearLayout buttonContainer = new LinearLayout(this);
        buttonContainer.setOrientation(LinearLayout.VERTICAL);
        buttonContainer.setGravity(Gravity.CENTER_HORIZONTAL);

        Button stop = new Button(this);
        stop.setText(isBn ? "⏹️ অ্যালার্ম বন্ধ করুন" : "⏹️ Stop Alarm");
        stop.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        stop.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        stop.setTextColor(Color.parseColor("#FFFFFF"));
        GradientDrawable stopBg = new GradientDrawable();
        stopBg.setCornerRadius(dp(28));
        stopBg.setColor(Color.parseColor("#E11D48"));
        stop.setBackground(stopBg);
        stop.setElevation(dp(4));
        stop.setOnClickListener(view -> finishAlarm(AlarmRingingService.ACTION_STOP));
        LinearLayout.LayoutParams stopParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(56)
        );
        stopParams.setMargins(0, 0, 0, dp(14));
        buttonContainer.addView(stop, stopParams);

        Button snooze = new Button(this);
        snooze.setText(isBn ? "⏰ ৫ মিনিট পরে বাজান" : "⏰ Snooze 5 min");
        snooze.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        snooze.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        snooze.setTextColor(Color.parseColor("#FDE68A"));
        GradientDrawable snoozeBg = new GradientDrawable();
        snoozeBg.setCornerRadius(dp(28));
        snoozeBg.setColor(Color.parseColor("#1B2A4A"));
        snoozeBg.setStroke(dp(1), Color.parseColor("#E2B341"));
        snooze.setBackground(snoozeBg);
        snooze.setOnClickListener(view -> finishAlarm(AlarmRingingService.ACTION_SNOOZE));
        LinearLayout.LayoutParams snoozeParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(52)
        );
        buttonContainer.addView(snooze, snoozeParams);

        LinearLayout.LayoutParams btnContainerParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        root.addView(buttonContainer, btnContainerParams);

        setContentView(root);
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
