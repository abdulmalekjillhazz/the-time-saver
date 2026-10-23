package com.madeyourdreambigger.smartroutine;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Calendar;
import java.util.TimeZone;

final class AlarmScheduler {
    static final String ACTION_ALARM_FIRED = "com.madeyourdreambigger.smartroutine.ALARM_FIRED";
    static final String EXTRA_ID = "alarmId";
    static final String EXTRA_LABEL = "alarmLabel";
    static final String EXTRA_LANGUAGE = "alarmLanguage";
    private static final String PREFS = "smart_routine_native_alarms";
    private static final String ALARMS_KEY = "alarms";

    private AlarmScheduler() {}

    static void schedule(Context context, String id, long at, String label, String language) throws JSONException {
        schedule(context, id, at, label, language, false, "");
    }

    static void schedule(Context context, String id, long at, String label, String language, boolean repeatDaily) throws JSONException {
        schedule(context, id, at, label, language, repeatDaily, "");
    }

    static void schedule(Context context, String id, long at, String label, String language, boolean repeatDaily, String timeZone) throws JSONException {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            throw new SecurityException("Allow exact alarms in Android settings before scheduling.");
        }
        // Keep the original daily anchor across snoozes/refreshes so a repeating
        // routine does not drift to "five minutes later every day" after snooze.
        JSONObject previous = getAlarm(context, id);
        long anchorAt = repeatDaily && previous != null && previous.optLong("anchorAt", 0) > 0
            ? previous.optLong("anchorAt", 0)
            : (repeatDaily ? at : 0);
        JSONObject alarm = new JSONObject()
            .put("id", id)
            .put("at", at)
            .put("label", label)
            .put("language", language)
            .put("repeat", repeatDaily)
            .put("anchorAt", anchorAt)
            .put("timeZone", timeZone == null ? "" : timeZone)
            .put("firedAt", JSONObject.NULL);
        JSONArray alarms = getAlarms(context);
        JSONArray updated = new JSONArray();
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject item = alarms.optJSONObject(i);
            if (item != null && !id.equals(item.optString("id"))) updated.put(item);
        }
        updated.put(alarm);
        save(context, updated);

        Intent intent = new Intent(context, AlarmReceiver.class)
            .setAction(ACTION_ALARM_FIRED)
            .setData(Uri.parse("smart-routine://alarm/" + Uri.encode(id)))
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_LABEL, label)
            .putExtra(EXTRA_LANGUAGE, language);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, pendingIntent), pendingIntent);
    }

    static void cancel(Context context, String id) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AlarmReceiver.class)
            .setAction(ACTION_ALARM_FIRED)
            .setData(Uri.parse("smart-routine://alarm/" + Uri.encode(id)));
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pendingIntent != null) {
            manager.cancel(pendingIntent);
            pendingIntent.cancel();
        }
        JSONArray alarms = getAlarms(context);
        JSONArray remaining = new JSONArray();
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject item = alarms.optJSONObject(i);
            if (item != null && !id.equals(item.optString("id"))) remaining.put(item);
        }
        save(context, remaining);
    }

    static void markFired(Context context, String id) {
        JSONArray alarms = getAlarms(context);
        JSONArray updated = new JSONArray();
        long firedAt = System.currentTimeMillis();
        String label = "";
        String language = "bn";
        boolean repeatDaily = false;
        long nextRepeatAt = 0;
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject item = alarms.optJSONObject(i);
            if (item == null) continue;
            if (id.equals(item.optString("id"))) {
                try {
                    item = new JSONObject(item.toString());
                    label = item.optString("label", "");
                    language = item.optString("language", "bn");
                    repeatDaily = item.optBoolean("repeat", false);
                    if (repeatDaily) {
                        long anchor = item.optLong("anchorAt", 0);
                        nextRepeatAt = nextDailyExecution(
                            anchor > 0 ? anchor : item.optLong("at", firedAt),
                            firedAt,
                            item.optString("timeZone", "")
                        );
                        item.put("at", nextRepeatAt);
                        item.put("firedAt", JSONObject.NULL);
                    } else {
                        item.put("firedAt", firedAt);
                    }
                } catch (JSONException ignored) {
                    Log.e("SmartRoutineAlarm", "Could not record a fired alarm.");
                    continue;
                }
            }
            updated.put(item);
        }
        save(context, updated);
        if (repeatDaily) {
            // Keep a daily routine alarm alive after the app (or the whole process)
            // has been closed. Without this, only the day the app was opened had a
            // native alarm and later days were silently skipped.
            try {
                String timeZone = "";
                for (int i = 0; i < updated.length(); i++) {
                    JSONObject item = updated.optJSONObject(i);
                    if (item != null && id.equals(item.optString("id"))) {
                        timeZone = item.optString("timeZone", "");
                        break;
                    }
                }
                schedule(context, id, nextRepeatAt, label, language, true, timeZone);
            } catch (JSONException | SecurityException error) {
                Log.e("SmartRoutineAlarm", "Could not reschedule the daily alarm.", error);
            }
        }
        Intent fired = new Intent("com.madeyourdreambigger.smartroutine.ALARM_EVENT")
            .setPackage(context.getPackageName())
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_LABEL, label)
            .putExtra(EXTRA_LANGUAGE, language)
            .putExtra("firedAt", firedAt);
        context.sendBroadcast(fired);
    }

    static JSONObject getAlarm(Context context, String id) {
        JSONArray alarms = getAlarms(context);
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject item = alarms.optJSONObject(i);
            if (item != null && id.equals(item.optString("id"))) return item;
        }
        return null;
    }

    static JSONArray getAlarms(Context context) {
        String value = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(ALARMS_KEY, "[]");
        try {
            return new JSONArray(value);
        } catch (JSONException ignored) {
            Log.e("SmartRoutineAlarm", "Stored alarm data was invalid.");
            return new JSONArray();
        }
    }

    static void reschedule(Context context) {
        JSONArray alarms = getAlarms(context);
        long now = System.currentTimeMillis();
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm == null || !JSONObject.NULL.equals(alarm.opt("firedAt"))) continue;
            String id = alarm.optString("id", "");
            if (TextUtils.isEmpty(id)) continue;
            boolean repeatDaily = alarm.optBoolean("repeat", false);
            long at = alarm.optLong("at", 0);
            String timeZone = alarm.optString("timeZone", "");
            if (repeatDaily) {
                long anchor = alarm.optLong("anchorAt", 0);
                at = nextDailyExecution(anchor > 0 ? anchor : at, now, timeZone);
            }
            if (at > now) {
                try {
                    schedule(context, id, at, alarm.optString("label", ""), alarm.optString("language", "bn"), repeatDaily, timeZone);
                } catch (JSONException | SecurityException ignored) {
                    Log.e("SmartRoutineAlarm", "Could not restore an alarm after device restart.");
                }
            }
        }
    }

    // One day later in the device's local calendar, preserving the wall-clock
    // time across daylight-saving changes. Repeating daily alarms are only used
    // for routines, which the product defines as daily.
    private static long nextDailyExecution(long previousAt, long now, String timeZone) {
        if (previousAt > now) return previousAt;
        Calendar calendar = timeZone == null || timeZone.isEmpty()
            ? Calendar.getInstance()
            : Calendar.getInstance(TimeZone.getTimeZone(timeZone));
        calendar.setTimeInMillis(previousAt > 0 ? previousAt : now);
        do {
            calendar.add(Calendar.DAY_OF_YEAR, 1);
        } while (calendar.getTimeInMillis() <= now);
        return calendar.getTimeInMillis();
    }

    private static void save(Context context, JSONArray alarms) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(ALARMS_KEY, alarms.toString())
            .apply();
    }
}
