import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeAlarm = registerPlugin('NativeAlarm');

export function isAndroidNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function requestNativeAlarmPermissions() {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.requestAlarmPermissions();
}

export async function getNativeAlarmPermissions() {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.getAlarmPermissions();
}

export async function setNativeAlarmSound(dataUri) {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.setAlarmSound({ dataUri });
}

export async function setNativeStopwatchDisplay(active) {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.setStopwatchDisplay({ active });
}

export async function scheduleNativeAlarm(alarm, lang = 'bn') {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.schedule({
    id: alarm.id,
    at: alarm.at,
    label: alarm.label || '',
    lang,
    repeatDaily: Boolean(alarm.repeatDaily),
    timeZone: typeof alarm.timeZone === 'string' ? alarm.timeZone : '',
  });
}

export async function cancelNativeAlarm(id) {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.cancel({ id });
}

export async function stopNativeAlarm(id = '') {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.stop({ id });
}

export async function getNativeAlarmStates() {
  if (!isAndroidNativeApp()) return { alarms: [] };
  return NativeAlarm.getAlarmStates();
}

export async function addNativeAlarmListener(listener) {
  if (!isAndroidNativeApp()) return null;
  return NativeAlarm.addListener('alarmFired', listener);
}
