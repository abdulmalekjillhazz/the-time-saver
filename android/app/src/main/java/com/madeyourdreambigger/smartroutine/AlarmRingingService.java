package com.madeyourdreambigger.smartroutine;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class AlarmRingingService extends Service {
    static final String ACTION_RING = "com.madeyourdreambigger.smartroutine.RING";
    static final String ACTION_STOP = "com.madeyourdreambigger.smartroutine.STOP";
    static final String ACTION_SNOOZE = "com.madeyourdreambigger.smartroutine.SNOOZE";
    private static final String CHANNEL_ID = "smart-routine-ringing-alarms";
    private static final int NOTIFICATION_ID = 4107;
    private String alarmId = "";
    private String alarmLabel = "";
    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopRinging();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_SNOOZE.equals(action)) {
            String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
            String label = intent.getStringExtra(AlarmScheduler.EXTRA_LABEL);
            if (id != null && !id.isEmpty()) {
                try {
                    AlarmScheduler.schedule(this, id, System.currentTimeMillis() + 5 * 60_000L, label == null ? "" : label);
                } catch (Exception ignored) {
                    Log.e("SmartRoutineAlarm", "Could not snooze the ringing alarm.");
                    stopRinging();
                    stopSelf();
                    return START_NOT_STICKY;
                }
            }
            stopRinging();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!ACTION_RING.equals(action)) return START_NOT_STICKY;

        alarmId = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        alarmLabel = intent.getStringExtra(AlarmScheduler.EXTRA_LABEL);
        if (alarmId == null) alarmId = "";
        if (alarmLabel == null) alarmLabel = "";
        startForeground(NOTIFICATION_ID, buildNotification());
        startRingtone();
        return START_NOT_STICKY;
    }

    private void startRingtone() {
        stopRingtone();
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtone == null) ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            player.setDataSource(this, ringtone);
            player.setLooping(true);
            player.prepare();
            player.start();
            PowerManager manager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SmartRoutine:Alarm");
            wakeLock.acquire(2 * 60 * 60 * 1000L);
        } catch (Exception error) {
            Log.e("SmartRoutineAlarm", "Could not start the alarm ringtone.", error);
            stopRingtone();
        }
    }

    private Notification buildNotification() {
        Intent fullScreen = new Intent(this, AlarmRingingActivity.class)
            .putExtra(AlarmScheduler.EXTRA_ID, alarmId)
            .putExtra(AlarmScheduler.EXTRA_LABEL, alarmLabel)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullScreenIntent = PendingIntent.getActivity(
            this,
            alarmId.hashCode(),
            fullScreen,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent stopIntent = serviceAction(ACTION_STOP, "stop");
        PendingIntent snoozeIntent = serviceAction(ACTION_SNOOZE, "snooze");
        String title = getString(R.string.alarm_notification_title);
        String body = alarmLabel.isEmpty() ? getString(R.string.alarm_notification_body) : alarmLabel;
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenIntent, true)
            .addAction(0, getString(R.string.alarm_stop), stopIntent)
            .addAction(0, getString(R.string.alarm_snooze), snoozeIntent)
            .build();
    }

    private PendingIntent serviceAction(String action, String suffix) {
        Intent intent = new Intent(this, AlarmRingingService.class)
            .setAction(action)
            .setData(Uri.parse("smart-routine://alarm-action/" + suffix + "/" + Uri.encode(alarmId)))
            .putExtra(AlarmScheduler.EXTRA_ID, alarmId)
            .putExtra(AlarmScheduler.EXTRA_LABEL, alarmLabel);
        return PendingIntent.getService(
            this,
            alarmId.hashCode() + suffix.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.alarm_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.alarm_channel_description));
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setSound(null, null);
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private void stopRingtone() {
        if (player != null) {
            if (player.isPlaying()) player.stop();
            player.release();
            player = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    private void stopRinging() {
        stopRingtone();
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NOTIFICATION_ID);
    }

    @Override
    public void onDestroy() {
        stopRinging();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
