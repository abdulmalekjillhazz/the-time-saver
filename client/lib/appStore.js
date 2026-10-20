import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Single global store for the whole web app.
//
// Rules for what lives here:
// - PERSISTED (device remembers): theme, language, alarms, stopwatch, prayer
//   preferences. Listed in `partialize` below.
// - SESSION-ONLY (this visit): activeTab, azanStatus. Global because more than
//   one component reads/writes them, but never saved to localStorage.
// - STAYS LOCAL (useState in components): server data (user, routines,
//   lessons), form inputs, one-off modal internals. Server data is fetched,
//   not stored — caching it in zustand would serve stale prayers/lessons.
//
// Selectors (`useAppStore((s) => s.theme)`) keep every component subscribed
// only to the slice it needs, so one state update never re-renders the app.
export const useAppStore = create(persist(
  (set) => ({
    // --- persisted: appearance & language ---
    theme: 'dark',
    language: null,
    setTheme: (theme) => set({ theme }),
    setLanguage: (language) => set({ language }),

    // --- persisted: alarms & focus timer ---
    alarms: [],
    alarmSoundId: 'birds',
    stopwatchElapsedMs: 0,
    stopwatchStartedAt: null,
    setAlarmSoundId: (alarmSoundId) => set({ alarmSoundId }),
    addAlarm: (alarm) => set((state) => ({ alarms: [...state.alarms, alarm] })),
    removeAlarm: (id) => set((state) => ({ alarms: state.alarms.filter((alarm) => alarm.id !== id) })),
    snoozeAlarm: (id, at) => set((state) => ({
      alarms: state.alarms.map((alarm) => alarm.id === id ? { ...alarm, at, firedAt: null } : alarm),
    })),
    markAlarmFired: (id) => set((state) => ({
      alarms: state.alarms.map((alarm) => alarm.id === id ? { ...alarm, firedAt: Date.now() } : alarm),
    })),
    startStopwatch: (now = Date.now()) => set((state) => (
      state.stopwatchStartedAt === null ? { stopwatchStartedAt: now } : state
    )),
    stopStopwatch: (now = Date.now()) => set((state) => ({
      stopwatchElapsedMs: state.stopwatchElapsedMs + (state.stopwatchStartedAt === null ? 0 : Math.max(0, now - state.stopwatchStartedAt)),
      stopwatchStartedAt: null,
    })),
    resetStopwatch: () => set({ stopwatchElapsedMs: 0, stopwatchStartedAt: null }),

    // --- persisted: prayer preferences ---
    showPrayerTimes: true,
    prayerNotificationsEnabled: false,
    lastPrayerNotificationId: '',
    setShowPrayerTimes: (showPrayerTimes) => set({ showPrayerTimes }),
    setPrayerNotificationsEnabled: (prayerNotificationsEnabled) => set({ prayerNotificationsEnabled }),
    setLastPrayerNotificationId: (lastPrayerNotificationId) => set({ lastPrayerNotificationId }),

    // --- session-only: navigation tab (today/dashboard/lessons/...) ---
    activeTab: 'today',
    setActiveTab: (activeTab) => set({ activeTab }),

    // --- session-only: azan download state (idle/ready/fallback) ---
    azanStatus: 'idle',
    setAzanStatus: (azanStatus) => set({ azanStatus }),
  }),
  {
    name: 'smart-routine-ui',
    version: 2,
    migrate: (persistedState) => ({ ...persistedState, alarmSoundId: 'dawn' }),
    storage: createJSONStorage(() => (typeof globalThis.window === 'undefined' ? undefined : globalThis.window.localStorage)),
    skipHydration: true,
    partialize: (state) => ({
      theme: state.theme,
      language: state.language,
      alarms: state.alarms,
      alarmSoundId: state.alarmSoundId,
      stopwatchElapsedMs: state.stopwatchElapsedMs,
      stopwatchStartedAt: state.stopwatchStartedAt,
      showPrayerTimes: state.showPrayerTimes,
      prayerNotificationsEnabled: state.prayerNotificationsEnabled,
      lastPrayerNotificationId: state.lastPrayerNotificationId,
    }),
  }
));
