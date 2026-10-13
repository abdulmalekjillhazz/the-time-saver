// Server mirror for one-shot alarms. Every helper resolves to null when the
// user is logged out or the network fails — local alarms always keep working.
import { apiRequest } from './apiClient.js';

const asAlarm = (row) => {
  if (!row || typeof row.clientId !== 'string') return null;
  return {
    id: row.clientId,
    at: row.at,
    label: row.name || '',
    firedAt: row.firedAt ?? null,
    acknowledgedAt: row.acknowledgedAt ?? null,
  };
};

export async function syncAlarmCreate(user, alarm) {
  if (!user) return null;
  try {
    const data = await apiRequest('/api/alarms', {
      method: 'POST',
      body: {
        clientId: alarm.id,
        at: alarm.at,
        name: alarm.label || '',
        timezone: user.timezone || 'Asia/Dhaka',
      },
    });
    return asAlarm(data.alarm);
  } catch {
    return null;
  }
}

export async function syncAlarmDelete(user, id) {
  if (!user) return null;
  try {
    await apiRequest(`/api/alarms/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  } catch {
    return null;
  }
}

export async function syncAlarmUpdate(user, id, patch) {
  if (!user) return null;
  try {
    const data = await apiRequest(`/api/alarms/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
    return asAlarm(data.alarm);
  } catch {
    return null;
  }
}

// The open app rang this alarm itself. Tell the server so the closed-app
// scheduler tick does not send a duplicate push.
export async function reportAlarmFired(user, id) {
  if (!user) return null;
  try {
    await apiRequest(`/api/alarms/${encodeURIComponent(id)}/fired`, { method: 'POST' });
    return true;
  } catch {
    return null;
  }
}

export async function fetchServerAlarms(user) {
  if (!user) return [];
  try {
    const data = await apiRequest('/api/alarms');
    return (data.alarms || []).map(asAlarm).filter(Boolean);
  } catch {
    return [];
  }
}

export async function fetchMissedAlarms(user, limit = 10) {
  if (!user) return [];
  try {
    const data = await apiRequest(`/api/alarms?missed=1&limit=${limit}`);
    return (data.alarms || []).map(asAlarm).filter(Boolean);
  } catch {
    return [];
  }
}

export async function acknowledgeAlarm(user, id) {
  if (!user) return null;
  try {
    await apiRequest(`/api/alarms/${encodeURIComponent(id)}`, { method: 'PATCH', body: { acknowledged: true } });
    return true;
  } catch {
    return null;
  }
}
