package com.madeyourdreambigger.smartroutine;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Locale;

public class AlarmRingingService extends Service {
    static final String ACTION_RING = "com.madeyourdreambigger.smartroutine.RING";
    static final String ACTION_STOP = "com.madeyourdreambigger.smartroutine.STOP";
    static final String ACTION_SNOOZE = "com.madeyourdreambigger.smartroutine.SNOOZE";
    private static final String CHANNEL_ID = "smart-routine-ringing-alarms";
    private static final int NOTIFICATION_ID = 4107;
    private String alarmId = "";
    private String alarmLabel = "";
    private String alarmLanguage = "bn";
    private MediaPlayer player;
    private TextToSpeech textToSpeech;
    private PowerManager.WakeLock wakeLock;
    private File customSoundFile;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
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
            String language = intent.getStringExtra(AlarmScheduler.EXTRA_LANGUAGE);
            if (id != null && !id.isEmpty()) {
                try {
                    // Preserve a repeating routine's daily alarm across snooze.
                    // The scheduler keeps the original anchor time, so the next
                    // daily ring stays at the routine's real start time.
                    org.json.JSONObject existing = AlarmScheduler.getAlarm(this, id);
                    boolean repeating = existing != null && existing.optBoolean("repeat", false);
                    String timeZone = existing == null ? "" : existing.optString("timeZone", "");
                    AlarmScheduler.schedule(
                        this,
                        id,
                        System.currentTimeMillis() + 5 * 60_000L,
                        label == null ? "" : label,
                        language == null ? "bn" : language,
                        repeating,
                        timeZone
                    );
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
        alarmLanguage = intent.getStringExtra(AlarmScheduler.EXTRA_LANGUAGE);
        if (alarmId == null) alarmId = "";
        if (alarmLabel == null) alarmLabel = "";
        if (alarmLanguage == null) alarmLanguage = "bn";
        startForeground(NOTIFICATION_ID, buildNotification());
        requestAlarmAudioFocus();
        startRingtone();
        speakAlarmName();
        return START_NOT_STICKY;
    }

    private void speakAlarmName() {
        stopAlarmSpeech();
        String phrase = alarmLanguage.equals("bn")
            ? "আপনার অ্যালার্ম " + (alarmLabel.isEmpty() ? "বাজছে" : alarmLabel + " বাজছে")
            : alarmLabel.isEmpty() ? "Your alarm is ringing." : "Your alarm, " + alarmLabel + ", is ringing.";

        textToSpeech = new TextToSpeech(this, status -> {
            TextToSpeech speaker = textToSpeech;
            if (speaker == null) return;
            if (status != TextToSpeech.SUCCESS) {
                Log.w("SmartRoutineAlarm", "Google Text-to-Speech could not initialize.");
                return;
            }
            speaker.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
            Locale locale = Locale.forLanguageTag(alarmLanguage.equals("bn") ? "bn-BD" : "en-US");
            int languageStatus = speaker.setLanguage(locale);
            if (languageStatus < TextToSpeech.LANG_AVAILABLE && alarmLanguage.equals("bn")) {
                languageStatus = speaker.setLanguage(new Locale("bn"));
            }
            if (languageStatus < TextToSpeech.LANG_AVAILABLE) {
                Log.w("SmartRoutineAlarm", "Google Text-to-Speech does not have the alarm language installed.");
                return;
            }
            speaker.setSpeechRate(0.95f);
            speaker.speak(phrase, TextToSpeech.QUEUE_FLUSH, new Bundle(), "alarm-" + alarmId);
        }, "com.google.android.tts");
    }

    private void stopAlarmSpeech() {
        if (textToSpeech == null) return;
        textToSpeech.stop();
        textToSpeech.shutdown();
        textToSpeech = null;
    }

    private void requestAlarmAudioFocus() {
        if (audioManager == null) return;
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(focusChange -> {})
                .build();
            audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
        }
    }

    private void abandonAlarmAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
            audioFocusRequest = null;
        } else {
            audioManager.abandonAudioFocus(null);
        }
    }

    private void startRingtone() {
        stopRingtone();
        String dataUri = getSharedPreferences(NativeAlarmPlugin.PREFS_ALARM, MODE_PRIVATE)
            .getString(NativeAlarmPlugin.PREF_ALARM_SOUND, null);
        if (dataUri != null) {
            try {
                customSoundFile = writeCustomSoundFile(dataUri);
                startPlayer(customSoundFile.getAbsolutePath());
                acquireWakeLock();
                return;
            } catch (Exception error) {
                Log.w("SmartRoutineAlarm", "Could not play the selected alarm sound; using the phone ringtone.", error);
                stopRingtone();
            }
        }
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (ringtone == null) ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        try {
            if (ringtone == null) throw new IllegalStateException("No default ringtone is available.");
            startPlayer(ringtone);
            acquireWakeLock();
        } catch (Exception error) {
            Log.e("SmartRoutineAlarm", "Could not start the alarm ringtone.", error);
            stopRingtone();
        }
    }

    private File writeCustomSoundFile(String dataUri) throws Exception {
        String prefix = "data:audio/wav;base64,";
        if (!dataUri.startsWith(prefix) || dataUri.length() > 250_000) {
            throw new IllegalArgumentException("Saved alarm sound data is invalid.");
        }
        byte[] wav = Base64.decode(dataUri.substring(prefix.length()), Base64.DEFAULT);
        if (
            wav.length < 44 || wav.length > 180_000
            || wav[0] != 'R' || wav[1] != 'I' || wav[2] != 'F' || wav[3] != 'F'
            || wav[8] != 'W' || wav[9] != 'A' || wav[10] != 'V' || wav[11] != 'E'
        ) {
            throw new IllegalArgumentException("Saved alarm sound is not a valid WAV file.");
        }
        File file = new File(getCacheDir(), "smart-routine-alarm.wav");
        try {
            try (FileOutputStream output = new FileOutputStream(file, false)) {
                output.write(wav);
                output.flush();
            }
            return file;
        } catch (Exception error) {
            file.delete();
            throw error;
        }
    }

    private void startPlayer(String filePath) throws Exception {
        player = createPlayer();
        player.setDataSource(filePath);
        player.setLooping(true);
        player.prepare();
        player.start();
    }

    private void startPlayer(Uri source) throws Exception {
        player = createPlayer();
        player.setDataSource(this, source);
        player.setLooping(true);
        player.prepare();
        player.start();
    }

    private MediaPlayer createPlayer() {
        MediaPlayer newPlayer = new MediaPlayer();
        newPlayer.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build());
        return newPlayer;
    }

    private void acquireWakeLock() {
        PowerManager manager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SmartRoutine:Alarm");
        wakeLock.acquire(2 * 60 * 60 * 1000L);
    }

    private Notification buildNotification() {
        Intent fullScreen = new Intent(this, AlarmRingingActivity.class)
            .putExtra(AlarmScheduler.EXTRA_ID, alarmId)
            .putExtra(AlarmScheduler.EXTRA_LABEL, alarmLabel)
            .putExtra(AlarmScheduler.EXTRA_LANGUAGE, alarmLanguage)
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
            .setSmallIcon(R.drawable.ic_stat_alarm)
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
            .putExtra(AlarmScheduler.EXTRA_LABEL, alarmLabel)
            .putExtra(AlarmScheduler.EXTRA_LANGUAGE, alarmLanguage);
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
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        channel.setBypassDnd(true);
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private void stopRingtone() {
        abandonAlarmAudioFocus();
        if (player != null) {
            if (player.isPlaying()) player.stop();
            player.release();
            player = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
        if (customSoundFile != null) {
            customSoundFile.delete();
            customSoundFile = null;
        }
    }

    private void stopRinging() {
        stopAlarmSpeech();
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
