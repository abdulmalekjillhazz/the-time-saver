package com.madeyourdreambigger.smartroutine;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        if (id == null || id.isEmpty()) return;
        String label = intent.getStringExtra(AlarmScheduler.EXTRA_LABEL);
        AlarmScheduler.markFired(context, id);
        Intent ringing = new Intent(context, AlarmRingingService.class)
            .setAction(AlarmRingingService.ACTION_RING)
            .putExtra(AlarmScheduler.EXTRA_ID, id)
            .putExtra(AlarmScheduler.EXTRA_LABEL, label == null ? "" : label);
        ContextCompat.startForegroundService(context, ringing);
    }
}
