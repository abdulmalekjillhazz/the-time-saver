package com.madeyourdreambigger.smartroutine;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "NativeAlarm",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class NativeAlarmPlugin extends Plugin {
    static final String PREFS_ALARM = "smart-routine-alarm";
    static final String PREF_ALARM_SOUND = "alarmSoundDataUri";
    private BroadcastReceiver alarmEventReceiver;
    private int originalSystemUiVisibility = -1;

    @Override
    public void load() {
        alarmEventReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject event = new JSObject();
                event.put("id", intent.getStringExtra(AlarmScheduler.EXTRA_ID));
                event.put("firedAt", intent.getLongExtra("firedAt", System.currentTimeMillis()));
                notifyListeners("alarmFired", event, true);
            }
        };
        IntentFilter filter = new IntentFilter("com.madeyourdreambigger.smartroutine.ALARM_EVENT");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(alarmEventReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(alarmEventReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        setStopwatchDisplay(false);
        if (alarmEventReceiver != null) {
            getContext().unregisterReceiver(alarmEventReceiver);
            alarmEventReceiver = null;
        }
    }

    @PluginMethod
    public void getAlarmPermissions(PluginCall call) {
        call.resolve(permissionState());
    }

    @PluginMethod
    public void requestAlarmPermissions(PluginCall call) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        openNextSettings(call);
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        openNextSettings(call);
    }

    @ActivityCallback
    private void onExactAlarmSettings(PluginCall call, ActivityResult result) {
        openNextSettings(call);
    }

    @ActivityCallback
    private void onFullScreenSettings(PluginCall call, ActivityResult result) {
        call.resolve(permissionState());
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        String id = call.getString("id");
        String label = call.getString("label", "");
        String language = call.getString("lang", "bn");
        Long at = call.getLong("at");
        if (id == null || id.isEmpty() || id.length() > 64 || at == null || at <= System.currentTimeMillis()) {
            call.reject("Choose a valid future alarm time.");
            return;
        }
        if (!permissionsGranted()) {
            call.reject("Enable Android alarm, notification, and full-screen permissions first.", "PERMISSION_REQUIRED");
            return;
        }
        if (label.length() > 60) {
            call.reject("Alarm names must be 60 characters or fewer.");
            return;
        }
        try {
            AlarmScheduler.schedule(getContext(), id, at, label, language);
            call.resolve();
        } catch (JSONException | SecurityException error) {
            call.reject("Android could not schedule this exact alarm. Check alarm permission settings.", error);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("An alarm id is required.");
            return;
        }
        AlarmScheduler.cancel(getContext(), id);
        stopAlarmService(id);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopAlarmService(call.getString("id", ""));
        call.resolve();
    }

    @PluginMethod
    public void setAlarmSound(PluginCall call) {
        String dataUri = call.getString("dataUri");
        String prefix = "data:audio/wav;base64,";
        if (dataUri == null || !dataUri.startsWith(prefix) || dataUri.length() > 250_000) {
            call.reject("The selected alarm sound is invalid.");
            return;
        }
        try {
            byte[] wav = Base64.decode(dataUri.substring(prefix.length()), Base64.DEFAULT);
            if (
                wav.length < 44 || wav.length > 180_000
                || wav[0] != 'R' || wav[1] != 'I' || wav[2] != 'F' || wav[3] != 'F'
                || wav[8] != 'W' || wav[9] != 'A' || wav[10] != 'V' || wav[11] != 'E'
            ) {
                call.reject("The selected alarm sound is not a valid WAV file.");
                return;
            }
            getContext().getSharedPreferences(PREFS_ALARM, Context.MODE_PRIVATE)
                .edit()
                .putString(PREF_ALARM_SOUND, dataUri)
                .apply();
            call.resolve();
        } catch (IllegalArgumentException error) {
            call.reject("The selected alarm sound could not be decoded.", error);
        }
    }

    @PluginMethod
    public void setStopwatchDisplay(PluginCall call) {
        boolean active = call.getBoolean("active", false);
        setStopwatchDisplay(active);
        call.resolve();
    }

    private void setStopwatchDisplay(boolean active) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            View decor = window.getDecorView();
            if (active) {
                if (originalSystemUiVisibility < 0) {
                    originalSystemUiVisibility = decor.getSystemUiVisibility();
                }
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                );
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                if (originalSystemUiVisibility >= 0) {
                    decor.setSystemUiVisibility(originalSystemUiVisibility);
                    originalSystemUiVisibility = -1;
                }
            }
        });
    }

    @PluginMethod
    public void getAlarmStates(PluginCall call) {
        JSArray alarms = new JSArray();
        org.json.JSONArray nativeAlarms = AlarmScheduler.getAlarms(getContext());
        for (int i = 0; i < nativeAlarms.length(); i++) {
            JSONObject alarm = nativeAlarms.optJSONObject(i);
            if (alarm == null) continue;
            JSObject item = new JSObject();
            item.put("id", alarm.optString("id"));
            item.put("at", alarm.optLong("at"));
            item.put("label", alarm.optString("label"));
            item.put("firedAt", alarm.isNull("firedAt") ? null : alarm.optLong("firedAt"));
            alarms.put(item);
        }
        JSObject result = new JSObject();
        result.put("alarms", alarms);
        call.resolve(result);
    }

    private void openNextSettings(PluginCall call) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && !((AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms()
        ) {
            openSettings(call, new Intent(
                android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:" + getContext().getPackageName())
            ), "onExactAlarmSettings");
            return;
        }
        if (Build.VERSION.SDK_INT >= 34 && !canUseFullScreenIntent()) {
            openSettings(call, new Intent(
                android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:" + getContext().getPackageName())
            ), "onFullScreenSettings");
            return;
        }
        call.resolve(permissionState());
    }

    private void openSettings(PluginCall call, Intent intent, String callback) {
        try {
            startActivityForResult(call, intent, callback);
        } catch (Exception error) {
            call.reject("Android alarm permission settings could not be opened.", error);
        }
    }

    private JSObject permissionState() {
        JSObject result = new JSObject();
        result.put(
            "notifications",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED
        );
        result.put(
            "exactAlarms",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || ((AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms()
        );
        result.put("fullScreenIntent", Build.VERSION.SDK_INT < 34 || canUseFullScreenIntent());
        return result;
    }

    private boolean permissionsGranted() {
        JSObject state = permissionState();
        return state.optBoolean("notifications")
            && state.optBoolean("exactAlarms")
            && state.optBoolean("fullScreenIntent");
    }

    private boolean canUseFullScreenIntent() {
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        return manager.canUseFullScreenIntent();
    }

    private void stopAlarmService(String id) {
        Intent intent = new Intent(getContext(), AlarmRingingService.class)
            .setAction(AlarmRingingService.ACTION_STOP)
            .putExtra(AlarmScheduler.EXTRA_ID, id);
        getContext().startService(intent);
    }
}
