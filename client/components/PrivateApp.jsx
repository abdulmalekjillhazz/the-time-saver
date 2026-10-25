'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { App } from '@capacitor/app';
import { createUuidV4, predictMissProbability, routineFeatures, TRAINING_CONSENT_VERSION, todayInZone } from '@smart-routine/shared';
import { enqueueAndFlush } from '../lib/outboxClient.js';
import { announceLearningActivity } from '../lib/learningFeedback.js';
import { useAppStore } from '../lib/appStore.js';
import {
  apiRequest,
  clearStoredSessionToken,
  getStoredSessionToken,
  resolveApiUrl,
  setStoredSessionToken,
} from '../lib/apiClient.js';
import { signInWithGoogleNative } from '../lib/nativeGoogleAuth.js';
import {
  cacheOfflineLesson,
  clearOfflineStoryCache,
  getOfflineCacheConsent,
  getOfflineLesson,
  listOfflineLessons,
  setOfflineCacheConsent,
} from '../lib/offlineStoryCache.js';
import { cacheOfflineUser, clearOfflineUser, isOfflineFailure, readOfflineUser } from '../lib/offlineSession.js';
import { requireUserProfile } from '../lib/userProfile.js';
import { SITE_URL } from '../lib/seo.js';
import { clearCachedRoutines, loadCachedRoutinesForOffline, saveCachedRoutines } from '../lib/routineCache.js';
import { buildRoutineAlarms } from '../lib/routineAlarms.js';
import { base64UrlToBytes, bengaliCalendarMonthRange, buildCalendarDays } from '../lib/calendar.js';
import { getRoutineMood } from '../lib/routineMood.js';
import { buildAlarmAnnouncement, getNextRoutineTitle, speakWithGoogleTts, speakWithVoice, buildMissedAnnouncement } from '../lib/voiceBriefing.js';
import { SpeakingSituations } from './SpeakingSituations.jsx';
import { syncAlarmCreate, syncAlarmDelete, syncAlarmUpdate, reportAlarmFired, fetchServerAlarms, fetchMissedAlarms, acknowledgeAlarm } from '../lib/alarmsSync.js';
import { ensureAlarmPushSubscription } from '../lib/pushClient.js';
import { ALARM_SOUNDS, getAlarmSoundDataUri, playAlarmSound, stopAlarmSound } from '../lib/notificationSound.js';
import {
  addNativeAlarmListener,
  cancelNativeAlarm,
  getNativeAlarmPermissions,
  getNativeAlarmStates,
  isAndroidNativeApp,
  requestNativeAlarmPermissions,
  scheduleNativeAlarm,
  setNativeAlarmSound,
  setNativeStopwatchDisplay,
  stopNativeAlarm,
} from '../lib/nativeAlarm.js';
import { getFocusRoutines } from '../lib/routineFocus.js';
import { AiBadge } from './ui/AiBadge.jsx';
import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';
import { StatusChip } from './ui/StatusChip.jsx';
import { SyncStatus } from './SyncStatus.jsx';
import { PointsAwardToast } from './PointsAwardToast.jsx';

const TelegramSettingsCard = dynamic(() => import('./TelegramSettingsCard.jsx').then((m) => m.TelegramSettingsCard), { ssr: false });
const HabitCirclesCard = dynamic(() => import('./HabitCirclesCard.jsx').then((m) => m.HabitCirclesCard), { ssr: false });
const PrayerTimesCard = dynamic(() => import('./PrayerTimesCard.jsx').then((m) => m.PrayerTimesCard), { ssr: false });
const VoiceBriefingModal = dynamic(() => import('./VoiceBriefingModal.jsx').then((m) => m.VoiceBriefingModal), { ssr: false });
const EveningReflectionModal = dynamic(() => import('./EveningReflectionModal.jsx').then((m) => m.EveningReflectionModal), { ssr: false });
const HeatmapGrid = dynamic(() => import('./HeatmapGrid.jsx').then((m) => m.HeatmapGrid), { ssr: false });
const BadgesShowcase = dynamic(() => import('./BadgesShowcase.jsx').then((m) => m.BadgesShowcase), { ssr: false });
const AdaptiveReplanModal = dynamic(() => import('./AdaptiveReplanModal.jsx').then((m) => m.AdaptiveReplanModal), { ssr: false });
const RoutineDashboard = dynamic(() => import('./RoutineDashboard.jsx').then((m) => m.RoutineDashboard), { ssr: false });
const GoalToRoutine = dynamic(() => import('./GoalToRoutine.jsx').then((m) => m.GoalToRoutine), { ssr: false });
const TemplatePicker = dynamic(() => import('./TemplatePicker.jsx').then((m) => m.TemplatePicker), { ssr: false });
const AudioDramaPlayer = dynamic(() => import('./AudioDramaPlayer.jsx').then((m) => m.AudioDramaPlayer), { ssr: false });
const DailyLessonCard = dynamic(() => import('./DailyLessonCard.jsx').then((m) => m.DailyLessonCard), { ssr: false });
const GrammarLessons = dynamic(() => import('./GrammarLessons.jsx').then((m) => m.GrammarLessons), { ssr: false });
import { ProfileAvatar, ProfileAvatarPicker } from './ProfileAvatar.jsx';
import { TodayProgressCard } from './TodayProgressCard.jsx';
import { StoryReader } from './StoryReader.jsx';
import { PrayerAnchorSelector } from './PrayerAnchorSelector.jsx';
import { AddRoutineBuilderCard } from './AddRoutineBuilderCard.jsx';
import { LeaderboardPanel } from './LeaderboardPanel.jsx';
import { GamificationBar } from './GamificationBar.jsx';
import { formatNaturalTime } from '../lib/prayerAnchors.js';

const DESKTOP_CONSTELLATION_POINTS = [
  [16, 49],
  [47, 25],
  [78, 54],
  [109, 20],
  [140, 48],
  [171, 27],
  [202, 52],
];

const COPY = {
  en: {
    title: 'Smart Routine', today: "Today's routine", lessons: 'Lessons & quizzes', insights: 'Miss risk insights', dashboard: 'Dashboard', voiceBriefing: 'Voice briefing', leaderboard: 'Leaderboard',
    settings: 'Settings', register: 'Create account', login: 'Sign in', email: 'Email', password: 'Password',
    name: 'Display name', locale: 'Language', create: 'Create account', signIn: 'Sign in', switchRegister: 'Need an account?',
    googleSignIn: 'Continue with Google',
    profile: 'Your profile', profileName: 'Name shown in the app', profileAvatar: 'Profile avatar', editProfile: 'View or edit your profile', saveProfile: 'Save profile', profileSaved: 'Your profile was updated.',
    invalidUserResponse: 'The server did not return a valid user profile. Please try signing in again.',
    passwordHint: 'Choose any password you like (up to 128 characters).',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    switchLogin: 'Already have an account?', logout: 'Sign out', loading: 'Loading your private app…', addRoutine: 'Add a routine',
    offlineRestored: 'You are offline. Showing the routines saved on this device; changes will sync when you reconnect.',
    offlineStaleRoutines: 'You are offline. Showing the most recent routine saved on this device. Completion status is not carried over.',
    routineName: 'Routine name', start: 'Start time', end: 'End time', category: 'Category', priority: 'Priority', anchorHabit: 'After I… (anchor habit)',
    mood: 'Routine mood', moodNeutral: 'Looks balanced', moodHappy: 'Nice duration', moodAngry: 'That is too long',
    moodHelp: 'Up to 1 hour stays neutral, over 1–4 hours smiles, and over 4 hours gets angry.',
    timeInvalid: 'Choose different start and end times.',
    routineDuration: (hours, minutes) => `${hours}h ${minutes}m`,
    low: 'Low', medium: 'Medium', high: 'High', add: 'Add routine', delete: 'Delete', save: 'Save status',
    focus20: 'Your next important tasks', focus20Help: 'The routine you mark as most important appears first here after you add it. Other unfinished routines are ordered by your chosen priority and start time.',
    markImportant: 'This is my most important task', importantHelp: 'After saving, it will appear at the top of your focus list and be highlighted in today’s routine.',
    importantTag: 'Most important · Do this first',
    done: 'Done', missed: 'Missed', skipped: 'Skipped', noRoutines: 'No routines yet. Add one to get started.',
    reminder: 'Starting soon', consent: 'Allow my data to help train future routine models',
    export: 'Export my data', deleteAccount: 'Delete my account', confirmPassword: 'Confirm with your password',
    exportNow: 'Download export', deleteNow: 'Permanently delete account', cancel: 'Cancel',
    noLessons: 'No published lessons are available yet.', read: 'Open lesson', quiz: 'Take quiz', closeLesson: 'Back to lessons', loadingLesson: 'Loading lesson…', lessonPrefetchWarning: 'Some lessons could not be preloaded and will load when opened.', storyPoints: 'points for reading', storyPointsAlreadyEarned: 'You already earned points for this story. Reading it again is still saved as a learning day.', quizPoints: 'leaderboard points', completeStory: 'Mark story complete', storyCompleted: 'Story completed', submit: 'Submit answers',
    risk: 'Estimated miss risk', noModel: 'No validated real-data model is active. The model file currently included is synthetic and is intentionally not used to estimate your personal risk.',
    routineSaved: 'Routine queued for sync.', routineDeleted: 'Routine queued for deletion.',
    completionSaved: 'Routine status saved.', completionPending: 'Routine status is still waiting to sync. The app will retry automatically.',
    completionRejected: 'Routine status was not saved. Refresh your routines and try again.',
    chooseLesson: 'Choose a lesson to view its content and quiz.',
    exportDone: 'Your data export has been downloaded.', accountDeleted: 'Your account was deleted.',
    noQuiz: 'This lesson has no quiz.', useAccount: 'Sign in or create an account to use your private routine.',
    select: 'Select', saveStatus: 'Save status', description: 'Build steady habits with a routine that fits your day.',
    languageToggle: 'Switch to Bengali',
    localModel: 'Local model', modelVersion: 'Version', modelAuc: 'Holdout AUC', modelBrier: 'Brier score',
    modelCalibration: 'Calibration slope', modelHoldout: 'Holdout examples', modelUnavailable: 'No validated local model is active. Risk predictions need a validated local model.', modelDemoWarning: 'Local synthetic demo only. These risk percentages are illustrative, not validated, and must not be used as personal predictions.',
    themeDark: 'Switch to dark mode', themeLight: 'Switch to light mode', alarmTitle: 'Alarms',
    alarmTime: 'Alarm time', alarmName: 'Alarm name', addAlarm: 'Set alarm', noAlarms: 'No alarms set yet.',
    alarmSound: 'Alarm sound', previewAlarmSound: 'Preview sound', stopAlarmSound: 'Stop preview',
    alarmSoundHelp: 'This sound plays with alarms while the app is open and for Android alarms when the app is closed. Browser notifications while the app is closed use the sound set by your browser or device.',
    enableBrowserNotifications: 'Enable browser notifications', browserNotificationsOn: 'Browser notifications are enabled.',
    browserNotificationsOff: 'Browser notifications are off. Tap Enable and allow them in your browser prompt.',
    browserNotificationsBlocked: 'Notifications are blocked in browser settings. Allow them for this site, then try again.',
    browserNotificationsUnsupported: 'This browser does not support notifications.',
    dangerAlertUnavailable: 'Live public danger alerts are not configured.',
    deviceDangerAlertsInfo: 'This app does not monitor Google emergency alerts. For Google crisis and wireless emergency alerts, use your Android phone’s Safety & emergency settings.',
    alarmRinging: 'Your alarm is ringing', stopAlarm: 'Stop alarm', removeAlarm: 'Remove alarm',
    snoozeAlarm: 'Snooze 5 min',
    stopwatch: 'Stopwatch', startTimer: 'Start', pauseTimer: 'Pause', resetTimer: 'Reset',
    expandStopwatch: 'Open full screen', collapseStopwatch: 'Exit full screen',
    voiceAlarmNote: 'When an alarm rings, your Google voice speaks the alarm name and your next routine, and a notification is sent with the same message. Alarms ring while this app is open.', nativeAlarmNote: 'Android uses your selected alarm sound and keeps alarms ringing when Smart Routine is closed. Allow the Android alarm permissions below.',     alarmVoiceUnavailable: 'The voice announcement could not play. The alarm sound may still be active.',
    alarmPushOn: 'Closed-app alerts are on for this device — alarms ring even with the app closed.', alarmPushOff: 'Turn on closed-app alerts so alarms ring even with the app closed.',
    enableClosedAppAlerts: '🔔 Enable closed-app alerts', pushUnavailable: 'Closed-app alerts are unavailable in this browser.',
    pushServiceUnavailable: 'This browser profile cannot receive closed-app alerts. Try a regular browser profile or the Android app; browser alarms only ring while this page is open.',
    enableNativeAlarm: '📞 Enable Android call-style alarms', nativeAlarmEnabled: 'Android alarms can ring when Smart Routine is closed.', nativeAlarmPermissionMissing: 'Allow notifications, exact alarms, and full-screen alarms in Android settings, then tap enable again.',
    missedAlarms: 'Missed alarms', acknowledgeAlarm: 'Got it', alarmSnoozed: 'Snoozed for 5 minutes.',
    alarmPermissionDenied: 'Browser notifications are blocked. The in-app alarm will still ring while this page is open.',
    focus: 'Focus', setFor: 'Scheduled for', alarmInvalid: 'Choose a future time for this alarm.', alarmDone: 'Rang',
    holidayCalendar: 'Bangla & English calendar', calendar: 'English calendar', previousMonth: 'Previous month', nextMonth: 'Next month',
    holidayCalendarHelp: 'Red dates are Bangladesh public holidays or weekly Friday–Saturday days off. Islamic holiday dates may shift with moon sighting.',
    weeklyDayOff: 'Weekly day off', holidayCalendarLoading: 'Loading holidays…', holidayCalendarError: 'Could not load holiday dates.',
    calendarLegend: 'Calendar key', regularDay: 'Regular day', holidayDay: 'Holiday / weekend', todayLabel: 'Today',
    enableHolidayNotifications: 'Enable holiday notifications', disableHolidayNotifications: 'Disable holiday notifications',
    holidayNotificationsEnabled: 'Holiday notifications are enabled for this device.',
    holidayPermissionDenied: 'Allow browser notifications to receive holiday reminders.',
    holidayNotificationsUnsupported: 'This browser does not support push notifications.',
    notificationDays: 'Reminders arrive at 6 p.m. the day before and 9 a.m. on the day off.',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  bn: {
    title: 'স্মার্ট রুটিন', today: 'আজকের রুটিন', lessons: 'পাঠ ও কুইজ', insights: 'রুটিন মিসের ঝুঁকি', dashboard: 'ড্যাশবোর্ড', voiceBriefing: 'ভয়েস ব্রিফিং', leaderboard: 'লিডারবোর্ড',
    settings: 'সেটিংস', register: 'অ্যাকাউন্ট তৈরি', login: 'সাইন ইন', email: 'ইমেইল', password: 'পাসওয়ার্ড',
    name: 'নাম', locale: 'ভাষা', create: 'অ্যাকাউন্ট তৈরি', signIn: 'সাইন ইন', switchRegister: 'অ্যাকাউন্ট নেই?',
    googleSignIn: 'Google দিয়ে চালিয়ে যান',
    profile: 'আপনার প্রোফাইল', profileName: 'অ্যাপে দেখানো নাম', profileAvatar: 'প্রোফাইল অবতার', editProfile: 'প্রোফাইল দেখুন বা সম্পাদনা করুন', saveProfile: 'প্রোফাইল সংরক্ষণ', profileSaved: 'আপনার প্রোফাইল আপডেট হয়েছে।',
    invalidUserResponse: 'সার্ভার থেকে সঠিক ব্যবহারকারী প্রোফাইল আসেনি। আবার সাইন ইন করার চেষ্টা করুন।',
    passwordHint: 'আপনার পছন্দমতো যেকোনো password দিন (সর্বোচ্চ ১২৮ অক্ষর)।',
    showPassword: 'পাসওয়ার্ড দেখান',
    hidePassword: 'পাসওয়ার্ড লুকান',
    switchLogin: 'আগে থেকেই অ্যাকাউন্ট আছে?', logout: 'সাইন আউট', loading: 'আপনার ব্যক্তিগত অ্যাপ লোড হচ্ছে…', addRoutine: 'রুটিন যোগ করুন',
    offlineRestored: 'আপনি অফলাইনে আছেন। এই ডিভাইসে সংরক্ষিত রুটিন দেখা হচ্ছে; ইন্টারনেট ফিরলে পরিবর্তনগুলো সিঙ্ক হবে।',
    offlineStaleRoutines: 'আপনি অফলাইনে আছেন। এই ডিভাইসে সর্বশেষ সংরক্ষিত রুটিনটি দেখানো হচ্ছে। আগের দিনের সম্পন্ন অবস্থা আজকের জন্য ধরা হচ্ছে না।',
    routineName: 'রুটিনের নাম', start: 'শুরুর সময়', end: 'শেষের সময়', category: 'ধরন', priority: 'গুরুত্ব', anchorHabit: 'এর পরে… (অভ্যাসের সংকেত)',
    mood: 'রুটিনের মুড', moodNeutral: 'সময়টা ভারসাম্যপূর্ণ', moodHappy: 'ভালো সময়', moodAngry: 'সময়টা অনেক বেশি',
    moodHelp: '১ ঘণ্টা পর্যন্ত নিরপেক্ষ, ১–৪ ঘণ্টায় হাসি, আর ৪ ঘণ্টার বেশি হলে রাগী হবে।',
    timeInvalid: 'শুরুর ও শেষের সময় আলাদা দিন।',
    routineDuration: (hours, minutes) => `${hours} ঘণ্টা ${minutes} মিনিট`,
    low: 'কম', medium: 'মাঝারি', high: 'বেশি', add: 'রুটিন যোগ করুন', delete: 'মুছুন', save: 'অবস্থা সংরক্ষণ',
    focus20: 'এখন কোন গুরুত্বপূর্ণ কাজটি করবেন', focus20Help: 'রুটিন যোগ করার সময় যেটিকে সবচেয়ে গুরুত্বপূর্ণ বলবেন, সেটি এখানে সবার আগে দেখাবে। বাকি অসমাপ্ত রুটিন আপনার বেছে নেওয়া গুরুত্ব ও শুরুর সময় অনুযায়ী সাজানো থাকবে।',
    markImportant: 'এটিই আমার সবচেয়ে গুরুত্বপূর্ণ কাজ', importantHelp: 'সংরক্ষণ করলে কাজটি আপনার ফোকাস তালিকার শুরুতে এবং আজকের রুটিনে আলাদা করে দেখাবে।',
    importantTag: 'সবচেয়ে গুরুত্বপূর্ণ · আগে করুন',
    done: 'সম্পন্ন', missed: 'মিস হয়েছে', skipped: 'বাদ দেওয়া', noRoutines: 'এখনো কোনো রুটিন নেই। শুরু করতে একটি যোগ করুন।',
    reminder: 'শুরু হতে যাচ্ছে', consent: 'ভবিষ্যতের রুটিন মডেল প্রশিক্ষণে আমার তথ্য ব্যবহারের অনুমতি দিন',
    export: 'আমার তথ্য এক্সপোর্ট', deleteAccount: 'আমার অ্যাকাউন্ট মুছুন', confirmPassword: 'পাসওয়ার্ড দিয়ে নিশ্চিত করুন',
    exportNow: 'এক্সপোর্ট ডাউনলোড', deleteNow: 'স্থায়ীভাবে অ্যাকাউন্ট মুছুন', cancel: 'বাতিল',
    noLessons: 'এখনো কোনো প্রকাশিত পাঠ নেই।',     read: 'পাঠ খুলুন', quiz: 'কুইজ দিন', closeLesson: 'পাঠের তালিকায় ফিরুন', loadingLesson: 'পাঠ লোড হচ্ছে…', lessonPrefetchWarning: 'কিছু পাঠ আগে থেকে লোড করা যায়নি; খুললে তখন লোড হবে।', storyPoints: 'গল্প পড়ার পয়েন্ট', storyPointsAlreadyEarned: 'এই গল্পের পয়েন্ট আগেই পেয়েছেন। আবার পড়লেও শেখার দিন হিসেবে সংরক্ষিত হবে।', quizPoints: 'লিডারবোর্ড পয়েন্ট', completeStory: 'গল্প পড়া শেষ করেছি', storyCompleted: 'গল্প সম্পন্ন', submit: 'উত্তর জমা দিন',
    risk: 'মিস হওয়ার আনুমানিক ঝুঁকি', noModel: 'যাচাইকৃত বাস্তব-তথ্যের কোনো মডেল চালু নেই। বর্তমানে থাকা মডেল ফাইলটি কৃত্রিম তথ্যের, তাই আপনার ব্যক্তিগত ঝুঁকি অনুমানে এটি ব্যবহার করা হয় না।',
    routineSaved: 'রুটিনটি সিঙ্কের জন্য রাখা হয়েছে।', routineDeleted: 'রুটিন মোছার অনুরোধ সিঙ্কের জন্য রাখা হয়েছে।',
    completionSaved: 'রুটিনের অবস্থা সংরক্ষিত হয়েছে।', completionPending: 'রুটিনের অবস্থা এখনো সিঙ্ক হয়নি। অ্যাপটি স্বয়ংক্রিয়ভাবে আবার চেষ্টা করবে।',
    completionRejected: 'রুটিনের অবস্থা সংরক্ষিত হয়নি। রুটিন রিফ্রেশ করে আবার চেষ্টা করুন।',
    chooseLesson: 'পাঠ ও কুইজ দেখতে একটি পাঠ বেছে নিন।',
    exportDone: 'আপনার তথ্য ডাউনলোড হয়েছে।', accountDeleted: 'আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে।',
    noQuiz: 'এই পাঠে কোনো কুইজ নেই।', useAccount: 'ব্যক্তিগত রুটিন ব্যবহার করতে সাইন ইন করুন বা অ্যাকাউন্ট তৈরি করুন।',
    select: 'বেছে নিন', saveStatus: 'অবস্থা সংরক্ষণ', description: 'আপনার দিনের সঙ্গে মানানসই রুটিনে অভ্যাস গড়ুন।',
    languageToggle: 'ইংরেজিতে পরিবর্তন করুন',
    localModel: 'স্থানীয় মডেল', modelVersion: 'সংস্করণ', modelAuc: 'Holdout AUC', modelBrier: 'Brier score',
    modelCalibration: 'Calibration slope', modelHoldout: 'Holdout উদাহরণ', modelUnavailable: 'যাচাইকৃত স্থানীয় মডেল চালু নেই। ঝুঁকির অনুমানের জন্য যাচাইকৃত স্থানীয় মডেল প্রয়োজন।', modelDemoWarning: 'শুধু স্থানীয় কৃত্রিম ডেমো। ঝুঁকির শতাংশ যাচাইকৃত নয়; ব্যক্তিগত পূর্বাভাস হিসেবে ব্যবহার করবেন না।',
    themeDark: 'ডার্ক মোড চালু করুন', themeLight: 'লাইট মোড চালু করুন', alarmTitle: 'অ্যালার্ম',
    alarmTime: 'অ্যালার্মের সময়', alarmName: 'অ্যালার্মের নাম', addAlarm: 'অ্যালার্ম সেট করুন', noAlarms: 'এখনো কোনো অ্যালার্ম সেট করা নেই।',
    alarmSound: 'অ্যালার্মের শব্দ', previewAlarmSound: 'শব্দ শুনুন', stopAlarmSound: 'শোনা বন্ধ করুন',
    alarmSoundHelp: 'অ্যাপ খোলা থাকলে এবং Android অ্যাপ বন্ধ থাকলেও অ্যালার্মে এই শব্দ বাজবে। Browser বন্ধ থাকলে notification-এর শব্দ browser বা device-এর সেটিংস অনুযায়ী হবে।',
    enableBrowserNotifications: 'ব্রাউজার নোটিফিকেশন চালু করুন', browserNotificationsOn: 'ব্রাউজার নোটিফিকেশন চালু আছে।',
    browserNotificationsOff: 'ব্রাউজার নোটিফিকেশন বন্ধ। চালু করুন চাপুন এবং ব্রাউজারের অনুমতি দিন।',
    browserNotificationsBlocked: 'ব্রাউজার সেটিংসে নোটিফিকেশন বন্ধ আছে। এই সাইটের জন্য চালু করে আবার চেষ্টা করুন।',
    browserNotificationsUnsupported: 'এই ব্রাউজারে নোটিফিকেশন সমর্থিত নয়।',
    dangerAlertUnavailable: 'লাইভ জরুরি সতর্কতার উৎস এখনো সেট করা নেই।',
    deviceDangerAlertsInfo: 'এই অ্যাপ Google-এর জরুরি সতর্কতা পর্যবেক্ষণ করে না। Google-এর crisis ও wireless emergency alert-এর জন্য Android ফোনের Safety & emergency সেটিংস ব্যবহার করুন।',
    alarmRinging: 'অ্যালার্ম বাজছে', stopAlarm: 'অ্যালার্ম বন্ধ করুন', removeAlarm: 'অ্যালার্ম সরান',
    snoozeAlarm: '৫ মিনিট স্নুজ',
    stopwatch: 'স্টপওয়াচ', startTimer: 'শুরু', pauseTimer: 'থামান', resetTimer: 'রিসেট',
    expandStopwatch: 'পুরো পর্দায় খুলুন', collapseStopwatch: 'পুরো পর্দা বন্ধ করুন',
    voiceAlarmNote: 'অ্যালার্ম বাজলে Google ভয়েসে অ্যালার্মের নাম ও পরের রুটিন শোনা যাবে, আর একই বার্তায় নোটিফিকেশন আসবে। অ্যাপ খোলা থাকলে অ্যালার্ম বাজবে।', nativeAlarmNote: 'Android-এ আপনার বেছে নেওয়া অ্যালার্মের শব্দ বাজবে এবং Smart Routine বন্ধ থাকলেও অ্যালার্ম চলবে। নিচের Android alarm অনুমতিগুলো দিন।',     alarmVoiceUnavailable: 'ভয়েস বার্তাটি চালানো যায়নি। অ্যালার্মের শব্দ আলাদাভাবে বাজতে পারে।',
    alarmPushOn: 'এই ডিভাইসে বন্ধ-অ্যাপ অ্যালার্ট চালু আছে — অ্যাপ বন্ধ থাকলেও অ্যালার্ম বাজবে।', alarmPushOff: 'বন্ধ-অ্যাপ অ্যালার্ট চালু করুন, তাহলে অ্যাপ বন্ধ থাকলেও অ্যালার্ম বাজবে।',
    enableClosedAppAlerts: '🔔 বন্ধ-অ্যাপ অ্যালার্ট চালু করুন', pushUnavailable: 'এই browser-এ বন্ধ-অ্যাপ অ্যালার্ট সমর্থিত নয়।',
    pushServiceUnavailable: 'এই browser profile বন্ধ-অ্যাপ alert নিতে পারছে না। সাধারণ browser profile বা Android app ব্যবহার করুন; browser alarm শুধু পেজ খোলা থাকলে বাজে।',
    enableNativeAlarm: '📞 Android কলের মতো অ্যালার্ম চালু করুন', nativeAlarmEnabled: 'Smart Routine বন্ধ থাকলেও Android অ্যালার্ম বাজতে পারবে।', nativeAlarmPermissionMissing: 'Android সেটিংসে notification, exact alarm ও full-screen alarm অনুমতি দিন, তারপর আবার চালু করুন।',
    missedAlarms: 'মিস হওয়া অ্যালার্ম', acknowledgeAlarm: 'বুঝেছি', alarmSnoozed: '৫ মিনিটের জন্য স্নুজ করা হয়েছে।',
    alarmPermissionDenied: 'ব্রাউজার নোটিফিকেশন বন্ধ আছে। পেজ খোলা থাকলে অ্যাপের ভেতর অ্যালার্ম বাজবে।',
    focus: 'ফোকাস', setFor: 'নির্ধারিত সময়', alarmInvalid: 'অ্যালার্মের জন্য ভবিষ্যতের সময় বেছে নিন।', alarmDone: 'বেজেছে',
    holidayCalendar: 'বাংলা ও ইংরেজি ক্যালেন্ডার', calendar: 'ইংরেজি ক্যালেন্ডার', previousMonth: 'আগের মাস', nextMonth: 'পরের মাস',
    holidayCalendarHelp: 'লাল তারিখগুলো বাংলাদেশে সরকারি ছুটি অথবা সাপ্তাহিক শুক্র–শনিবারের ছুটি। চাঁদ দেখার ওপর ইসলামি ছুটির তারিখ বদলাতে পারে।',
    weeklyDayOff: 'সাপ্তাহিক ছুটি', holidayCalendarLoading: 'ছুটির তারিখ লোড হচ্ছে…', holidayCalendarError: 'ছুটির তারিখ লোড করা যায়নি।',
    calendarLegend: 'ক্যালেন্ডার চিহ্ন', regularDay: 'সাধারণ দিন', holidayDay: 'ছুটি / সাপ্তাহিক বন্ধ', todayLabel: 'আজ',
    enableHolidayNotifications: 'ছুটির নোটিফিকেশন চালু করুন', disableHolidayNotifications: 'ছুটির নোটিফিকেশন বন্ধ করুন',
    holidayNotificationsEnabled: 'এই ডিভাইসে ছুটির নোটিফিকেশন চালু আছে।',
    holidayPermissionDenied: 'ছুটির নোটিফিকেশন পেতে ব্রাউজার নোটিফিকেশন অনুমতি দিন।',
    holidayNotificationsUnsupported: 'এই ব্রাউজারে push notification সমর্থিত নয়।',
    notificationDays: 'ছুটির আগের দিন সন্ধ্যা ৬টায় এবং ছুটির দিন সকাল ৯টায় নোটিফিকেশন আসবে।',
    weekdays: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
  },
};

function PasswordField({ label, copy, hint, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      {label}
      <span className="relative mt-1 block">
        <input
          {...inputProps}
          type={visible ? 'text' : 'password'}
          className="block w-full rounded-xl border border-gold/25 bg-paper/70 p-3 pr-12 text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        <button
          type="button"
          aria-label={visible ? copy.hidePassword : copy.showPassword}
          aria-pressed={visible}
          title={visible ? copy.hidePassword : copy.showPassword}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 flex min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded text-ink hover:bg-sapphire/10"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.3 3.2M6.2 6.2C4.3 7.5 3 9.4 2.5 12c.8 2 3.9 7 9.5 7 1.3 0 2.5-.3 3.6-.8" />
              </>
            ) : (
              <>
                <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </span>
      {hint ? <span className="mt-1 block text-sm">{hint}</span> : null}
    </label>
  );
}

function messageFrom(error, lang) {
  if (error?.code === 'INVALID_USER_RESPONSE') {
    return COPY[lang]?.invalidUserResponse || COPY.en.invalidUserResponse;
  }
  const message = error?.body?.error?.message ?? error?.error?.message ?? error?.message;
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') return message[lang] || message.en || message.bn || 'Request failed.';
  return 'Request failed.';
}

function LanguageFlag({ lang }) {
  if (lang === 'bn') {
    return (
      <svg aria-hidden="true" viewBox="0 0 30 20" className="language-flag">
        <rect width="30" height="20" rx="2" fill="rgb(0 106 78)" />
        <circle cx="14" cy="10" r="6" fill="rgb(244 42 65)" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 30 20" className="language-flag">
      <rect width="30" height="20" rx="2" fill="white" />
      <path d="M0 0h30v2.85H0zm0 5.7h30v2.85H0zm0 5.7h30v2.85H0zm0 5.7h30V20H0z" fill="rgb(178 34 52)" />
      <path d="M0 0h13v10H0z" fill="rgb(60 59 110)" />
      <path d="m3 2 .4 1.1L4.5 3.2l-.9.7.3 1.1L3 4.4l-.9.6.3-1.1-.9-.7 1.1-.1zM8 2l.4 1.1 1.1.1-.9.7.3 1.1L8 4.4l-.9.6.3-1.1-.9-.7 1.1-.1zM3 6l.4 1.1 1.1.1-.9.7.3 1.1L3 8.4l-.9.6.3-1.1-.9-.7 1.1-.1zM8 6l.4 1.1 1.1.1-.9.7.3 1.1L8 8.4l-.9.6.3-1.1-.9-.7 1.1-.1z" fill="white" />
    </svg>
  );
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  const sessionToken = getStoredSessionToken();
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const resolvedCsrfUrl = resolveApiUrl('/api/auth/csrf');
  const resolvedPath = resolveApiUrl(path);
  const credentialsMode = resolvedPath.startsWith('http') ? 'include' : 'same-origin';

  if (method !== 'GET' && method !== 'HEAD') {
    const csrfResponse = await fetch(resolvedCsrfUrl, {
      credentials: credentialsMode,
      cache: 'no-store',
      ...(sessionToken ? { headers: { Authorization: `Bearer ${sessionToken}` } } : {}),
    });
    const csrfBody = await csrfResponse.json().catch(() => ({}));
    if (!csrfResponse.ok) throw new Error(`Security token request failed (HTTP ${csrfResponse.status}).`);
    if (typeof csrfBody.csrfToken !== 'string') throw new Error('The security token response was invalid.');
    headers['X-CSRF-Token'] = csrfBody.csrfToken;
  }
  const response = await fetch(resolvedPath, {
    method,
    credentials: credentialsMode,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (raw) {
    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}.`);
      error.status = response.status;
      error.body = await response.json().catch(() => ({}));
      throw error;
    }
    return response;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path === '/api/me') {
      clearStoredSessionToken();
    }
    const error = new Error(`Request failed with status ${response.status}.`);
    error.status = response.status;
    error.body = payload;
    throw error;
  }
  if (typeof payload?.sessionToken === 'string' && payload.sessionToken) {
    setStoredSessionToken(payload.sessionToken);
  }
  if (path === '/api/auth/logout') {
    clearStoredSessionToken();
  }
  return payload;
}

function localized(value, lang) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value[lang] || value.en || value.bn || '';
  return '';
}

function localClock(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === 'hour')?.value) * 60
    + Number(parts.find((part) => part.type === 'minute')?.value);
}

function minutesAt(time) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function localDateTimeValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatStopwatch(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Keep the one-second tick local to the stopwatch readout. Updating clock state
// in PrivateApp rerendered this entire, feature-heavy screen every second.
function StopwatchReadout({ className = '', as: Element = 'span' }) {
  const elapsedMs = useAppStore((state) => state.stopwatchElapsedMs);
  const startedAt = useAppStore((state) => state.stopwatchStartedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const elapsed = elapsedMs + (startedAt === null ? 0 : Math.max(0, now - startedAt));
  return <Element className={className} role="timer" aria-live="off">{formatStopwatch(elapsed)}</Element>;
}

function GoogleSignInButton({ clientId, lang, disabled, nativeAndroid, onCredential, onError }) {
  const buttonRef = useRef(null);
  const wrapperRef = useRef(null);
  const credentialHandler = useRef(onCredential);
  const lastRenderKeyRef = useRef('');
  const [nativeLoginPending, setNativeLoginPending] = useState(false);
  const [browserLoginPending, setBrowserLoginPending] = useState(false);
  credentialHandler.current = onCredential;

  const renderGoogleButton = useCallback(() => {
    if (nativeAndroid) return;
    const googleAccounts = globalThis.google?.accounts?.id;
    if (!googleAccounts || !buttonRef.current) return;
    const availableWidth = wrapperRef.current?.clientWidth || 320;
    const buttonWidth = Math.max(200, Math.min(380, Math.floor(availableWidth)));
    const renderKey = `${clientId}:${lang}:${buttonWidth}`;
    if (lastRenderKeyRef.current === renderKey && buttonRef.current.childElementCount > 0) {
      return;
    }
    lastRenderKeyRef.current = renderKey;
    buttonRef.current.replaceChildren();
    googleAccounts.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) credentialHandler.current(response.credential);
      },
    });
    googleAccounts.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: lang,
      width: buttonWidth,
    });
  }, [clientId, lang, nativeAndroid]);

  useEffect(() => {
    if (nativeAndroid) return undefined;
    lastRenderKeyRef.current = '';
    renderGoogleButton();
    return undefined;
  }, [renderGoogleButton]);

  async function handleNativeSignIn() {
    if (nativeLoginPending || disabled) return;
    setNativeLoginPending(true);
    try {
      let resolvedClientId = typeof clientId === 'string' ? clientId.trim() : '';
      if (!resolvedClientId) {
        const cfg = await request('/api/auth/google/config').catch(() => ({}));
        resolvedClientId = typeof cfg?.clientId === 'string' ? cfg.clientId.trim() : '';
      }
      const credential = await signInWithGoogleNative(resolvedClientId);
      await credentialHandler.current(credential);
    } catch (err) {
      onError(err);
    } finally {
      setNativeLoginPending(false);
    }
  }

  async function handleBrowserSignIn() {
    if (browserLoginPending || disabled) return;
    setBrowserLoginPending(true);
    try {
      const { Browser } = await import('@capacitor/browser');
      const siteUrl = new URL(`/${lang === 'en' ? 'en' : 'bn'}/mobile-login`, SITE_URL);
      await Browser.open({ url: siteUrl.toString() });
    } catch (err) {
      onError(err);
    } finally {
      setBrowserLoginPending(false);
    }
  }

  if (nativeAndroid) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled={disabled || nativeLoginPending || browserLoginPending}
          onClick={handleNativeSignIn}
          className="mx-auto flex min-h-[48px] w-full max-w-[380px] items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={lang === 'bn' ? 'Google দিয়ে চালিয়ে যান' : 'Continue with Google'}
        >
          {nativeLoginPending ? (
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <svg className="h-5 w-5 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              {lang === 'bn' ? 'অপেক্ষা করুন...' : 'Signing in...'}
            </span>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="rgb(var(--brand-google-blue))"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
                />
                <path
                  fill="rgb(var(--brand-google-green))"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.15C3.25 21.36 7.35 24 12 24z"
                />
                <path
                  fill="rgb(var(--brand-google-yellow))"
                  d="M5.27 14.24A7.18 7.18 0 0 1 4.9 12c0-.78.14-1.54.37-2.24V6.61H1.26C.46 8.23 0 10.06 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.15z"
                />
                <path
                  fill="rgb(var(--brand-google-red))"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.25 2.64 1.26 6.61l4.01 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>{lang === 'bn' ? 'Google দিয়ে চালিয়ে যান' : 'Continue with Google'}</span>
            </>
          )}
        </button>
        <button
          type="button"
          disabled={disabled || nativeLoginPending || browserLoginPending}
          onClick={handleBrowserSignIn}
          className="mx-auto block min-h-[40px] w-full max-w-[380px] rounded-xl border border-gold/30 px-4 py-2 text-sm font-semibold text-ink/80 hover:bg-gold/10 disabled:opacity-60"
        >
          {browserLoginPending
            ? (lang === 'bn' ? 'ব্রাউজার খুলছে...' : 'Opening browser...')
            : (lang === 'bn' ? 'ব্রাউজার দিয়ে সাইন ইন করুন' : 'Sign in with browser')}
        </button>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={renderGoogleButton}
      />
      <div ref={wrapperRef} className="mx-auto flex min-h-[44px] w-full min-w-[200px] max-w-[380px] items-center justify-center">
        <div
          ref={buttonRef}
          aria-label={lang === 'bn' ? 'Google দিয়ে চালিয়ে যান' : 'Continue with Google'}
          aria-disabled={disabled}
          className={`flex min-h-[44px] w-full items-center justify-center overflow-hidden ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        />
      </div>
    </>
  );
}

export function PrivateApp() {
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [profileAvatarId, setProfileAvatarId] = useState('sunrise');
  const [authReady, setAuthReady] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const storedLanguage = useAppStore((state) => state.language);
  const setStoredLanguage = useAppStore((state) => state.setLanguage);
  const lang = storedLanguage === 'en' ? 'en' : 'bn';
  const [uiReady, setUiReady] = useState(false);
  const tab = useAppStore((state) => state.activeTab);
  const setTab = useAppStore((state) => state.setActiveTab);
  const [routines, setRoutines] = useState([]);
  const [routineStartTime, setRoutineStartTime] = useState('');
  const [routineEndTime, setRoutineEndTime] = useState('');
  const [anchorHabitInput, setAnchorHabitInput] = useState('');
  const [routineMoodHelpOpen, setRoutineMoodHelpOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1, 12);
  });
  const [calendarHolidays, setCalendarHolidays] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [holidayNotificationsEnabled, setHolidayNotificationsEnabled] = useState(false);
  const [holidayPushBusy, setHolidayPushBusy] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [offlineSavedLessons, setOfflineSavedLessons] = useState([]);
  const [dailyLesson, setDailyLesson] = useState(null);
  const grammarStorySources = useMemo(() => {
    const sources = [
      ...lessons,
      ...(dailyLesson ? [{
        ...dailyLesson,
        body: dailyLesson.body || dailyLesson.content,
      }] : []),
    ];
    return sources.map((story) => ({
      slug: story.slug,
      title: localized(story.title, 'en'),
      body: localized(story.body, 'en'),
      category: story.category,
      storyType: story.storyType,
    }));
  }, [dailyLesson, lessons]);
  const [dailyQuiz, setDailyQuiz] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [storyAward, setStoryAward] = useState(null);
  const [storyCompletionBusy, setStoryCompletionBusy] = useState(false);
  const speakingStoryCompletionsRef = useRef({ inFlight: new Set(), completed: new Set() });
  const [lessonLoadingSlug, setLessonLoadingSlug] = useState('');
  const lessonDetailsRef = useRef(new Map());
  const lessonRequestsRef = useRef(new Map());
  const [offlineLessonPreview, setOfflineLessonPreview] = useState(null);
  const [offlineCacheAllowed, setOfflineCacheAllowed] = useState(false);
  const [offlineConsentOpen, setOfflineConsentOpen] = useState(false);
  const [offlineCacheStatus, setOfflineCacheStatus] = useState('');
  const lessonFocusTargetRef = useRef('story');
  const [model, setModel] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordAction, setPasswordAction] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  const [reminderTime, setReminderTime] = useState(0);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const showPrayerTimes = useAppStore((state) => state.showPrayerTimes);
  const setShowPrayerTimes = useAppStore((state) => state.setShowPrayerTimes);
  const alarms = useAppStore((state) => state.alarms);
  const alarmSoundId = useAppStore((state) => state.alarmSoundId);
  const setAlarmSoundId = useAppStore((state) => state.setAlarmSoundId);
  const addAlarm = useAppStore((state) => state.addAlarm);
  const removeAlarm = useAppStore((state) => state.removeAlarm);
  const snoozeAlarm = useAppStore((state) => state.snoozeAlarm);
  const markAlarmFired = useAppStore((state) => state.markAlarmFired);
  const stopwatchStartedAt = useAppStore((state) => state.stopwatchStartedAt);
  const startStopwatch = useAppStore((state) => state.startStopwatch);
  const stopStopwatch = useAppStore((state) => state.stopStopwatch);
  const resetStopwatch = useAppStore((state) => state.resetStopwatch);
  const [alarmName, setAlarmName] = useState('');
  const [alarmTime, setAlarmTime] = useState('');
  const [isAlarmSoundPreviewing, setIsAlarmSoundPreviewing] = useState(false);
  const [stopwatchFullscreen, setStopwatchFullscreen] = useState(false);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState('default');
  const [firingAlarm, setFiringAlarm] = useState(null);
  const [missedAlarms, setMissedAlarms] = useState([]);
  const [pushAlarmReady, setPushAlarmReady] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);
  const [reflectionModalOpen, setReflectionModalOpen] = useState(false);
  const [voiceBriefingAutoPlay, setVoiceBriefingAutoPlay] = useState(false);

  const [replanRoutine, setReplanRoutine] = useState(null);
  const [activeRoutineTask, setActiveRoutineTask] = useState(null);
  const alarmSpeechRef = useRef(null);
  const alarmSpeechTimer = useRef(null);
  const alarmSoundPreviewTimer = useRef(null);
  const screenWakeLockRef = useRef(null);
  const firingAlarmRef = useRef(null);
  const catchupSpokenRef = useRef(false);
  const snoozeLinkHandledRef = useRef(false);
  const themeWaveTimerRef = useRef(null);
  const voiceBriefingTimerRef = useRef(null);
  const handledHandoffCodesRef = useRef(new Set());
  const copy = COPY[lang];
  const nativeAndroid = isAndroidNativeApp();
  const immersiveTab = ['focus', 'speaking', 'grammar'].includes(tab) || Boolean(activeRoutineTask);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.dataset.theme = nextTheme;
    root.classList.remove('theme-wave-light', 'theme-wave-dark');
    void root.offsetWidth;
    root.classList.add(`theme-wave-${nextTheme}`);
    if (themeWaveTimerRef.current !== null) window.clearTimeout(themeWaveTimerRef.current);
    themeWaveTimerRef.current = window.setTimeout(() => {
      root.classList.remove('theme-wave-light', 'theme-wave-dark');
      themeWaveTimerRef.current = null;
    }, 760);
    setTheme(nextTheme);
  }, [setTheme, theme]);

  const openVoiceBriefing = useCallback(() => {
    if (voiceBriefingTimerRef.current !== null) {
      window.clearTimeout(voiceBriefingTimerRef.current);
      voiceBriefingTimerRef.current = null;
    }
    setVoiceBriefingAutoPlay(false);
    setVoiceModalOpen(true);
  }, []);

  const reportError = useCallback((err) => {
    setError(messageFrom(err, lang));
    setNotice('');
  }, [lang]);
  const reportErrorRef = useRef(reportError);
  reportErrorRef.current = reportError;

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request('/api/me', {
        method: 'PATCH',
        body: { displayName: profileName, avatarId: profileAvatarId },
      });
      const updatedUser = requireUserProfile(result);
      setUser(updatedUser);
      setProfileName(updatedUser.displayName);
      setProfileAvatarId(updatedUser.avatarId || 'sunrise');
      setNotice(copy.profileSaved);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  const loadRoutines = useCallback(async (activeUser = user) => {
    if (!activeUser) return;
    const date = todayInZone(activeUser.timezone);
    try {
      const result = await request(`/api/routines?date=${encodeURIComponent(date)}`);
      setRoutines(result.routines);
      saveCachedRoutines(activeUser.id, date, result.routines);
    } catch (networkError) {
      if (!isOfflineFailure(networkError)) {
        reportError(networkError);
        return;
      }
      const cached = loadCachedRoutinesForOffline(activeUser.id, date);
      if (cached) {
        setRoutines(cached.routines);
        setNotice(cached.stale ? COPY[lang].offlineStaleRoutines : COPY[lang].offlineRestored);
        return;
      }
      reportError(networkError);
    }
  }, [user, lang]);

  const loadLessons = useCallback(async () => {
    const [publishedResult, dailyResult] = await Promise.allSettled([
      request('/api/lessons'),
      request('/api/lessons/today?locale=en'),
    ]);
    if (publishedResult.status === 'fulfilled') {
      setLessons(publishedResult.value.lessons);
    } else {
      try {
        const cachedLessons = getOfflineCacheConsent() === true
          ? await listOfflineLessons()
          : [];
        if (cachedLessons.length) {
          setLessons(cachedLessons);
          setOfflineSavedLessons(cachedLessons);
          setNotice('ইন্টারনেট সংযোগ নেই। এই ডিভাইসে আগে সংরক্ষিত পাঠগুলো দেখানো হচ্ছে।');
        } else {
          reportError(publishedResult.reason);
        }
      } catch (cacheError) {
        reportError(cacheError);
      }
    }
    if (dailyResult.status === 'fulfilled') {
      setDailyLesson(dailyResult.value.dailyLesson || null);
      setDailyQuiz(dailyResult.value.quiz || null);
    } else {
      try {
        const cachedLessons = getOfflineCacheConsent() === true
          ? await listOfflineLessons()
          : [];
        const cachedDailyLesson = cachedLessons.find((savedLesson) => savedLesson.isDailyStory);
        if (cachedDailyLesson) {
          setDailyLesson({ ...cachedDailyLesson, isOffline: true });
          setDailyQuiz(cachedDailyLesson.quiz || null);
          setNotice('ইন্টারনেট সংযোগ নেই। এই ডিভাইসে আগে সংরক্ষিত আজকের গল্প দেখানো হচ্ছে।');
        } else {
          setDailyLesson(null);
          setDailyQuiz(null);
          reportError(dailyResult.reason);
        }
      } catch (cacheError) {
        setDailyLesson(null);
        setDailyQuiz(null);
        reportError(cacheError);
      }
    }
  }, [reportError]);

  const getLessonDetails = useCallback((slug) => {
    const cached = lessonDetailsRef.current.get(slug);
    if (cached) return Promise.resolve(cached);

    const pending = lessonRequestsRef.current.get(slug);
    if (pending) return pending;

    const requestPromise = request(`/api/lessons/${encodeURIComponent(slug)}`)
      .then((result) => {
        lessonDetailsRef.current.set(slug, result.lesson);
        lessonRequestsRef.current.delete(slug);
        return result.lesson;
      })
      .catch((requestError) => {
        lessonRequestsRef.current.delete(slug);
        throw requestError;
      });
    lessonRequestsRef.current.set(slug, requestPromise);
    return requestPromise;
  }, []);

  useEffect(() => {
    if (!lessons.length) return undefined;
    let active = true;
    let prefetchFailed = false;
    let nextIndex = 0;
    const prefetchNext = async () => {
      while (active && nextIndex < lessons.length) {
        const item = lessons[nextIndex];
        nextIndex += 1;
        try {
          await getLessonDetails(item.slug);
        } catch {
          if (active && !prefetchFailed) {
            prefetchFailed = true;
            setNotice(copy.lessonPrefetchWarning);
          }
          active = false;
        }
      }
    };
    void Promise.all([prefetchNext(), prefetchNext()]);
    return () => {
      active = false;
    };
  }, [getLessonDetails, lang, lessons]);

  useEffect(() => {
    let active = true;
    useAppStore.persist.rehydrate()
      .then(() => {
        if (active) setUiReady(true);
      })
      .catch((err) => {
        if (active) {
          reportErrorRef.current(err);
          setUiReady(true);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!uiReady || !nativeAndroid) return undefined;
    let active = true;
    setNativeAlarmSound(getAlarmSoundDataUri(alarmSoundId))
      .catch((err) => { if (active) reportError(err); });
    return () => { active = false; };
  }, [alarmSoundId, nativeAndroid, reportError, uiReady]);

  useEffect(() => {
    if (!stopwatchFullscreen) return undefined;
    let active = true;
    if (nativeAndroid) {
      setNativeStopwatchDisplay(true).catch((err) => { if (active) reportError(err); });
    }
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setStopwatchFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      active = false;
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (nativeAndroid) setNativeStopwatchDisplay(false).catch(reportError);
      const wakeLock = screenWakeLockRef.current;
      screenWakeLockRef.current = null;
      if (wakeLock) void wakeLock.release().catch(reportError);
    };
  }, [nativeAndroid, reportError, stopwatchFullscreen]);

  useEffect(() => {
    let active = true;
    request('/api/auth/google/config')
      .then((result) => {
        if (active && typeof result.clientId === 'string') setGoogleClientId(result.clientId);
      })
      .catch(() => {
        if (active) setGoogleClientId('');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    request('/api/me')
      .then((result) => {
        if (!active) return;
        const currentUser = requireUserProfile(result);
        setUser(currentUser);
        cacheOfflineUser(currentUser);
        setProfileName(currentUser.displayName);
        setProfileAvatarId(currentUser.avatarId || 'sunrise');
        if (!useAppStore.getState().language) {
          setStoredLanguage(currentUser.locale === 'en' ? 'en' : 'bn');
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          clearOfflineUser();
          return;
        }
        const cachedUser = isOfflineFailure(err) ? readOfflineUser() : null;
        if (cachedUser) {
          // The API is unreachable but this device has an authenticated snapshot.
          // Keep the cached shell usable; the stored HTTP-only session cookie is
          // still the authority and every write goes through the sync outbox.
          setUser(cachedUser);
          setProfileName(cachedUser.displayName);
          setProfileAvatarId(cachedUser.avatarId || 'sunrise');
          if (!useAppStore.getState().language) {
            setStoredLanguage(cachedUser.locale === 'en' ? 'en' : 'bn');
          }
          setNotice(COPY[cachedUser.locale].offlineRestored);
          return;
        }
        if (err.status !== 500 && err.status !== 503) reportErrorRef.current(err);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => { active = false; };
  }, [setStoredLanguage]);

  useEffect(() => {
    if (user) cacheOfflineUser(user);
  }, [user]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!nativeAndroid && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((registrationError) => {
        if (/registration failed.*permission denied/i.test(registrationError?.message || '')) {
          setNotice(copy.pushServiceUnavailable);
          return;
        }
        reportErrorRef.current(registrationError);
      });
    }
    const handleBeforeInstall = (e) => {
      setPwaInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [nativeAndroid, copy.pushServiceUnavailable]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setBrowserNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([loadRoutines(user), loadLessons()])
      .catch(reportError);
    request('/api/model/current')
      .then(setModel)
      .catch((err) => {
        if (err.status === 404) setModel(null);
        else reportError(err);
      });
  }, [user, loadLessons, loadRoutines, reportError]);

  useEffect(() => {
    if (!user || !uiReady) return;
    try {
      const allowed = getOfflineCacheConsent();
      setOfflineCacheAllowed(allowed === true);
      if (allowed === null) setOfflineConsentOpen(true);
    } catch (consentError) {
      reportError(consentError);
    }
  }, [user, uiReady, reportError]);

  useEffect(() => {
    if (!uiReady) return undefined;
    let active = true;
    try {
      if (getOfflineCacheConsent() !== true) {
        setOfflineSavedLessons([]);
        return undefined;
      }
      listOfflineLessons()
        .then((savedLessons) => {
          if (active) setOfflineSavedLessons(savedLessons);
        })
        .catch(reportError);
    } catch (cacheError) {
      reportError(cacheError);
    }
    return () => { active = false; };
  }, [uiReady, offlineCacheAllowed, reportError]);

  useEffect(() => {
    if (!offlineCacheAllowed || !dailyLesson?.slug || dailyLesson.isOffline) return;
    const cachedStory = {
      ...dailyLesson,
      body: dailyLesson.content,
      quiz: dailyQuiz,
      isDailyStory: true,
    };
    cacheOfflineLesson(cachedStory, request)
      .then(async ({ lessonSaved }) => {
        if (lessonSaved) setOfflineSavedLessons(await listOfflineLessons());
      })
      .catch(reportError);
  }, [dailyLesson, dailyQuiz, offlineCacheAllowed, reportError]);

  useEffect(() => {
    if (!user) return undefined;
    const updateReminder = () => {
      try {
        setReminderTime(localClock(user.timezone));
      } catch (err) {
        reportError(err);
      }
    };
    updateReminder();
    const timer = window.setInterval(updateReminder, 60_000);
    const handleSynced = (event) => {
      if (event.detail?.userId === user.id) loadRoutines(user).catch(reportError);
    };
    window.addEventListener('smart-routine:sync', handleSynced);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('smart-routine:sync', handleSynced);
    };
  }, [user, loadRoutines, reportError]);

  useEffect(() => {
    if (!user) return;
    const [year, month] = todayInZone(user.timezone).split('-').map(Number);
    setCalendarMonth(new Date(year, month - 1, 1, 12));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    setCalendarLoading(true);
    setCalendarError('');
    request(`/api/calendar/holidays?year=${calendarMonth.getFullYear()}`)
      .then((result) => {
        if (active) setCalendarHolidays(result.holidays);
      })
      .catch((err) => {
        if (!active) return;
        setCalendarError(messageFrom(err, lang));
        setCalendarHolidays([]);
      })
      .finally(() => { if (active) setCalendarLoading(false); });
    return () => { active = false; };
  }, [calendarMonth, lang, user]);

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return undefined;
    let active = true;
    navigator.serviceWorker.getRegistration('/')
      .then((registration) => registration?.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!subscription) return false;
        const query = new URLSearchParams({ endpoint: subscription.endpoint });
        const preferences = await request(`/api/push/subscriptions/preferences?${query}`);
        return preferences.holidayReminders;
      })
      .then((enabled) => {
        if (active) setHolidayNotificationsEnabled(enabled);
      })
      .catch((err) => { if (active) reportErrorRef.current(err); });
    return () => { active = false; };
  }, [user]);

  const [hybridPredictions, setHybridPredictions] = useState([]);
  const [localCalibration, setLocalCalibration] = useState(() => {
    if (typeof window === 'undefined') return { biasDelta: 0, earlyDelta: 0, durationDelta: 0, lowPriorityDelta: 0 };
    try {
      const saved = window.localStorage.getItem('sr-hybrid-calibration-v1');
      return saved ? JSON.parse(saved) : { biasDelta: 0, earlyDelta: 0, durationDelta: 0, lowPriorityDelta: 0 };
    } catch {
      return { biasDelta: 0, earlyDelta: 0, durationDelta: 0, lowPriorityDelta: 0 };
    }
  });

  const localPredictions = useMemo(() => {
    if (!user || !routines.length) return [];
    const effectiveModel = model || {
      version: 'hybrid-local-v2',
      features: ['early', 'start_hour', 'duration_min', 'weekday', 'priority_low', 'priority_medium'],
      mean: [0.28, 12.5, 45.0, 3.0, 0.25, 0.45],
      scale: [0.45, 5.2, 30.0, 2.0, 0.43, 0.50],
      coefficients: [-0.22, 0.18, 0.34, 0.08, 0.38, 0.14],
      intercept: -0.85,
    };
    const calibratedModel = {
      ...effectiveModel,
      intercept: effectiveModel.intercept + (Number(localCalibration?.biasDelta) || 0),
      coefficients: effectiveModel.coefficients.map((c, idx) => {
        if (idx === 0) return c + (Number(localCalibration?.earlyDelta) || 0);
        if (idx === 2) return c + (Number(localCalibration?.durationDelta) || 0);
        if (idx === 4) return c + (Number(localCalibration?.lowPriorityDelta) || 0);
        return c;
      }),
    };
    const weekday = new Date(`${todayInZone(user.timezone)}T00:00:00.000Z`).getUTCDay();
    return routines.map((routine) => {
      const prob = predictMissProbability(calibratedModel, routineFeatures(routine, weekday));
      const direction = routine.isFrog
        ? (lang === 'bn' ? 'সবচেয়ে গুরুত্বপূর্ণ কাজ—দিনের শুরুতেই সম্পন্ন করুন।' : 'Most important task—complete this first today.')
        : !routine.anchorHabit
          ? (lang === 'bn' ? 'মিস এড়াতে একটি নিয়মিত অভ্যাসের সাথে যুক্ত করুন।' : 'Anchor this to an existing daily habit to avoid missing it.')
          : (lang === 'bn' ? 'নির্ধারিত সময়ের ৫ মিনিট আগে প্রস্তুতি নিন।' : 'Prepare 5 minutes before the scheduled start time.');
      return {
        ...routine,
        localProbability: prob,
        probability: prob,
        direction,
      };
    }).sort((a, b) => b.probability - a.probability);
  }, [model, routines, user, localCalibration, lang]);

  useEffect(() => {
    if (!user || !routines.length) {
      setHybridPredictions([]);
      return undefined;
    }
    let active = true;
    request('/api/assistant/predict-hybrid', {
      method: 'POST',
      body: {
        lang,
        routines: routines.map((r) => ({
          id: r.id,
          title: r.title,
          startTime: r.startTime,
          endTime: r.endTime,
          priority: r.priority,
          category: r.category,
          anchorHabit: r.anchorHabit,
          isFrog: r.isFrog,
          completionStatus: r.completionStatus,
        })),
      },
    })
      .then((res) => {
        if (!active || !res) return;
        if (Array.isArray(res.predictions)) {
          setHybridPredictions(res.predictions);
        }
        if (res.calibration && typeof window !== 'undefined') {
          setLocalCalibration(res.calibration);
          try {
            window.localStorage.setItem('sr-hybrid-calibration-v1', JSON.stringify(res.calibration));
          } catch {}
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user, routines, lang]);

  const predictions = useMemo(() => {
    if (!localPredictions.length) return [];
    const hybridById = new Map(hybridPredictions.map((p) => [String(p.id), p]));
    return localPredictions.map((item) => {
      const h = hybridById.get(String(item.id));
      if (!h) return item;
      return {
        ...item,
        probability: typeof h.probability === 'number' ? h.probability : item.probability,
        localProbability: typeof h.localProbability === 'number' ? h.localProbability : item.localProbability,
        aiProbability: typeof h.aiProbability === 'number' ? h.aiProbability : item.probability,
        localCorrected: Boolean(h.localCorrected),
        direction: h.direction || item.direction,
      };
    }).sort((a, b) => b.probability - a.probability);
  }, [localPredictions, hybridPredictions]);
  const routineMood = getRoutineMood(routineStartTime, routineEndTime);

  const reminders = useMemo(() => routines.filter((routine) => {
    if (routine.completionStatus) return false;
    const start = minutesAt(routine.startTime);
    return (start - reminderTime + 1440) % 1440 <= 10;
  }), [reminderTime, routines]);
  const focusRoutines = useMemo(() => getFocusRoutines(routines), [routines]);
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth.getFullYear(), calendarMonth.getMonth(), calendarHolidays, { includeBengaliDates: lang === 'bn' }),
    [calendarHolidays, calendarMonth, lang],
  );
  const banglaMonthRange = useMemo(() => (
    lang === 'bn' ? bengaliCalendarMonthRange(calendarMonth.getFullYear(), calendarMonth.getMonth()) : null
  ), [calendarMonth, lang]);
  const calendarToday = user ? todayInZone(user.timezone) : '';
  const englishMonth = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(calendarMonth);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!user || tab !== 'today') {
      if (voiceBriefingTimerRef.current !== null) {
        window.clearTimeout(voiceBriefingTimerRef.current);
        voiceBriefingTimerRef.current = null;
      }
      setVoiceModalOpen(false);
      setVoiceBriefingAutoPlay(false);
      return undefined;
    }

    voiceBriefingTimerRef.current = window.setTimeout(() => {
      voiceBriefingTimerRef.current = null;
      setVoiceBriefingAutoPlay(true);
      setVoiceModalOpen(true);
    }, 4000);

    return () => {
      if (voiceBriefingTimerRef.current !== null) {
        window.clearTimeout(voiceBriefingTimerRef.current);
        voiceBriefingTimerRef.current = null;
      }
    };
  }, [tab, user?.id]);

  useEffect(() => () => {
    if (themeWaveTimerRef.current !== null) window.clearTimeout(themeWaveTimerRef.current);
    document.documentElement.classList.remove('theme-wave-light', 'theme-wave-dark');
  }, []);

  useEffect(() => {
    if (!nativeAndroid) return undefined;
    let active = true;
    let nativeListener = null;
    const syncNativeAlarmState = async () => {
      const result = await getNativeAlarmStates();
      if (!active) return;
      for (const nativeAlarm of result.alarms || []) {
        const localAlarm = useAppStore.getState().alarms.find((alarm) => alarm.id === nativeAlarm.id);
        if (!localAlarm) continue;
        if (nativeAlarm.firedAt && !localAlarm.firedAt) {
          markAlarmFired(nativeAlarm.id);
          void reportAlarmFired(user, nativeAlarm.id);
        } else if (!nativeAlarm.firedAt && localAlarm.firedAt && nativeAlarm.at > Date.now()) {
          snoozeAlarm(nativeAlarm.id, nativeAlarm.at);
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNativeAlarmState().catch(reportError);
    };
    void syncNativeAlarmState().catch(reportError);
    document.addEventListener('visibilitychange', onVisible);
    addNativeAlarmListener(({ id }) => {
      if (!id) return;
      const localAlarm = useAppStore.getState().alarms.find((alarm) => alarm.id === id);
      if (localAlarm && !localAlarm.firedAt) markAlarmFired(id);
      if (localAlarm) {
        setFiringAlarm(localAlarm);
        firingAlarmRef.current = localAlarm;
        const announcement = buildAlarmAnnouncement({
          alarmName: localAlarm.label,
          lang,
          nextRoutineTitle: getNextRoutineTitle(routines, new Date().getHours()),
        });
        try {
          alarmSpeechRef.current?.stop();
          alarmSpeechRef.current = speakWithGoogleTts(announcement.text, {
            lang,
            locale: lang,
            onError: reportError,
          });
        } catch (err) {
          reportError(err);
        }
      }
      void reportAlarmFired(user, id);
    }).then((listener) => {
      if (!active) listener?.remove();
      else nativeListener = listener;
    }).catch(reportError);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      nativeListener?.remove();
    };
  }, [nativeAndroid, user, lang, routines, markAlarmFired, snoozeAlarm, reportError]);

  useEffect(() => {
    if (!nativeAndroid) return undefined;
    let active = true;
    const syncPermissionsAndAlarms = async () => {
      const permissions = await getNativeAlarmPermissions();
      if (!active) return;
      const enabled = Boolean(permissions?.notifications && permissions?.exactAlarms && permissions?.fullScreenIntent);
      setPushAlarmReady(enabled);
      if (!enabled) return;
      const pendingAlarms = alarms.filter((alarm) => !alarm.firedAt && alarm.at > Date.now());
      const routineAlarms = buildRoutineAlarms(routines, new Date(), user?.timezone);
      await Promise.all([
        ...pendingAlarms.map((alarm) => scheduleNativeAlarm(alarm, lang)),
        ...routineAlarms.map((alarm) => scheduleNativeAlarm(alarm, lang)),
      ]);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncPermissionsAndAlarms().catch(reportError);
    };
    void syncPermissionsAndAlarms().catch(reportError);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [nativeAndroid, alarms, routines, pushAlarmReady, lang, user?.timezone, reportError]);

  useEffect(() => {
    if (nativeAndroid) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const due = useAppStore.getState().alarms.filter((alarm) => !alarm.firedAt && alarm.at <= now);
      if (!due.length) return;
      const store = useAppStore.getState();
      due.forEach((alarm) => store.markAlarmFired(alarm.id));
      const firing = due[0];
      if (alarmSoundPreviewTimer.current) window.clearTimeout(alarmSoundPreviewTimer.current);
      alarmSoundPreviewTimer.current = null;
      setIsAlarmSoundPreviewing(false);
      stopAlarmSound();
      playAlarmSound(store.alarmSoundId);
      setFiringAlarm(firing);
      firingAlarmRef.current = firing;
      // Tell the server we rang it ourselves, so the closed-app tick skips it.
      void reportAlarmFired(user, firing.id);
      // Voice alarm: Google voice speaks the alarm name and the next routine,
      // and the notification below carries the same spoken message as its body.
      const announcement = buildAlarmAnnouncement({
        alarmName: firing.label,
        lang,
        nextRoutineTitle: getNextRoutineTitle(routines, new Date().getHours()),
      });
      const speakOnce = () => {
        try {
          alarmSpeechRef.current?.stop();
          alarmSpeechRef.current = speakWithGoogleTts(announcement.text, {
            lang,
            locale: lang,
            onError: () => setError(copy.alarmVoiceUnavailable),
          });
        } catch (err) {
          reportError(err);
        }
      };
      speakOnce();
      if (alarmSpeechTimer.current) window.clearInterval(alarmSpeechTimer.current);
      alarmSpeechTimer.current = window.setInterval(() => {
        if (!firingAlarmRef.current) {
          window.clearInterval(alarmSpeechTimer.current);
          alarmSpeechTimer.current = null;
          return;
        }
        speakOnce();
      }, 25_000);
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(copy.alarmRinging, { body: announcement.text, tag: `smart-routine-alarm-${firing.id}`, silent: true });
        } catch (err) {
          reportError(err);
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lang, routines, user, copy.alarmRinging, copy.alarmVoiceUnavailable, reportError, nativeAndroid]);

  useEffect(() => () => {
    alarmSpeechRef.current?.stop();
    alarmSpeechRef.current = null;
    if (alarmSpeechTimer.current) window.clearInterval(alarmSpeechTimer.current);
    if (alarmSoundPreviewTimer.current) window.clearTimeout(alarmSoundPreviewTimer.current);
    stopAlarmSound();
  }, []);

  // Merge server alarms on login: pull missing ones down, push offline ones up.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const serverAlarms = await fetchServerAlarms(user);
      if (!active || !serverAlarms.length) return;
      const store = useAppStore.getState();
      const localIds = new Set(store.alarms.map((alarm) => alarm.id));
      for (const alarm of serverAlarms) {
        if (!localIds.has(alarm.id)) store.addAlarm(alarm);
      }
      const serverIds = new Set(serverAlarms.map((alarm) => alarm.id));
      for (const alarm of store.alarms) {
        if (!serverIds.has(alarm.id)) await syncAlarmCreate(user, alarm);
        else if (alarm.firedAt) await reportAlarmFired(user, alarm.id);
      }
    })().catch(() => {});
    return () => { active = false; };
  }, [user]);

  // Catch-up voice: alarms that rang while the app was closed are spoken on return.
  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const checkMissed = async () => {
      const missed = await fetchMissedAlarms(user);
      if (!active) return;
      setMissedAlarms(missed);
      if (missed.length && !catchupSpokenRef.current) {
        catchupSpokenRef.current = true;
        const announcement = buildMissedAnnouncement({ names: missed.map((alarm) => alarm.label), lang });
        try {
          speakWithVoice(announcement.text, { lang: lang === 'bn' ? 'bn-BD' : 'en-US' });
        } catch {
          // Voice is best effort; the missed list below still shows.
        }
      }
    };
    void checkMissed();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkMissed();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, lang]);

  // ?snooze=<alarmId> deep link from the push notification action button.
  useEffect(() => {
    if (!user || snoozeLinkHandledRef.current || typeof window === 'undefined') return;
    snoozeLinkHandledRef.current = true;
    const id = new URLSearchParams(window.location.search).get('snooze');
    if (!id) return;
    const alarm = useAppStore.getState().alarms.find((row) => row.id === id);
    if (!alarm) return;
    snoozeOneAlarm(id);
    window.history.replaceState(null, '', window.location.pathname);
  }, [user]);

  async function scheduleAlarm(event) {
    event.preventDefault();
    const at = new Date(alarmTime).getTime();
    if (!Number.isFinite(at) || at <= Date.now()) {
      setError(copy.alarmInvalid);
      return;
    }
    if (!nativeAndroid && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        reportError(err);
      }
    }
    const created = { id: createUuidV4(), at, label: alarmName.trim(), firedAt: null };
    if (nativeAndroid) {
      try {
        const permissions = await getNativeAlarmPermissions();
        if (!permissions?.notifications || !permissions?.exactAlarms || !permissions?.fullScreenIntent) {
          setError(copy.nativeAlarmPermissionMissing);
          return;
        }
        await scheduleNativeAlarm(created, lang);
      } catch (err) {
        reportError(err);
        return;
      }
    }
    addAlarm(created);
    setAlarmName('');
    setAlarmTime('');
    setNotice(copy.addAlarm);
    setError('');
    // Mirror to the server (logged in only) so push/Telegram reach a closed app.
    if (!nativeAndroid && user && 'Notification' in window && Notification.permission === 'granted') {
      void ensureAlarmPushSubscription()
        .then(() => setPushAlarmReady(true))
        .catch(() => {});
    }
    void syncAlarmCreate(user, created);
  }

  // Big friendly button: notification permission + push subscription together,
  // so alarms ring even with the app closed. Needs an account (server holds alarms).
  async function enableClosedAppAlerts() {
    setError('');
    setNotice('');
    try {
      if (nativeAndroid) {
        const permissions = await requestNativeAlarmPermissions();
        if (!permissions?.notifications || !permissions?.exactAlarms || !permissions?.fullScreenIntent) {
          setPushAlarmReady(false);
          setError(copy.nativeAlarmPermissionMissing);
          return;
        }
        setPushAlarmReady(true);
        setNotice(copy.nativeAlarmEnabled);
        return;
      }
      if (!user) throw new Error(copy.useAccount);
      if (!('Notification' in window)) throw new Error(copy.browserNotificationsUnsupported);
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      setBrowserNotificationPermission(permission);
      if (permission !== 'granted') {
        throw new Error(lang === 'bn' ? '❌ ব্যর্থ হয়েছে! ব্রাউজার সেটিংস থেকে Notification Allow (অনুমতি) দিন।' : '❌ Failed! Please allow notifications in browser settings.');
      }
      await ensureAlarmPushSubscription();
      setPushAlarmReady(true);
      const successMsg = lang === 'bn'
        ? '✅ সফল হয়েছে! আপনার অ্যালার্ম ও নোটিফিকেশন বেল চালু হয়েছে।'
        : '✅ Success! Your alarm and notification bell are now enabled.';
      setNotice(successMsg);
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.showNotification) {
            await reg.showNotification(lang === 'bn' ? '🔔 অ্যালার্ম নোটিফিকেশন চালু হয়েছে' : '🔔 Alarm Notifications Enabled', {
              body: successMsg,
              icon: '/icon.svg',
            });
          } else {
            new Notification(lang === 'bn' ? '🔔 অ্যালার্ম নোটিফিকেশন চালু হয়েছে' : '🔔 Alarm Notifications Enabled', { body: successMsg });
          }
        } else {
          new Notification(lang === 'bn' ? '🔔 অ্যালার্ম নোটিফিকেশন চালু হয়েছে' : '🔔 Alarm Notifications Enabled', { body: successMsg });
        }
      } catch {}
    } catch (err) {
      const msg = err?.message === 'push-service-unavailable'
        ? copy.pushServiceUnavailable
        : messageFrom(err, lang);
      setError(msg.startsWith('❌') ? msg : `❌ ${msg}`);
    }
  }

  async function enableHolidayNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setError(copy.holidayNotificationsUnsupported);
      return;
    }

    setHolidayPushBusy(true);
    setError('');
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error(copy.holidayPermissionDenied);

      const { publicKey } = await request('/api/push/public-key');
      if (typeof publicKey !== 'string' || !publicKey) throw new Error(copy.holidayNotificationsUnsupported);
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey),
        });
      const subscriptionData = subscription.toJSON();
      if (!subscriptionData.endpoint || !subscriptionData.keys?.p256dh || !subscriptionData.keys?.auth) {
        throw new Error(copy.holidayNotificationsUnsupported);
      }
      const query = new URLSearchParams({ endpoint: subscriptionData.endpoint });
      const existingPreferences = await request(`/api/push/subscriptions/preferences?${query}`);
      await request('/api/push/subscriptions', {
        method: 'POST',
        body: {
          endpoint: subscriptionData.endpoint,
          keys: subscriptionData.keys,
          routineReminders: existingPreferences.routineReminders,
          holidayReminders: true,
        },
      });
      setHolidayNotificationsEnabled(true);
      setNotice(copy.holidayNotificationsEnabled);
    } catch (err) {
      setError(messageFrom(err, lang));
    } finally {
      setHolidayPushBusy(false);
    }
  }

  async function disableHolidayNotifications() {
    setHolidayPushBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await request('/api/push/subscriptions', {
          method: 'DELETE',
          body: { endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe();
      }
      setHolidayNotificationsEnabled(false);
      setNotice('');
    } catch (err) {
      reportError(err);
    } finally {
      setHolidayPushBusy(false);
    }
  }

  function dismissAlarm() {
    if (nativeAndroid && firingAlarm) void stopNativeAlarm(firingAlarm.id).catch(reportError);
    stopAlarmSound();
    alarmSpeechRef.current?.stop();
    alarmSpeechRef.current = null;
    if (alarmSpeechTimer.current) window.clearInterval(alarmSpeechTimer.current);
    alarmSpeechTimer.current = null;
    firingAlarmRef.current = null;
    setFiringAlarm(null);
  }

  function previewAlarmSound() {
    if (isAlarmSoundPreviewing) {
      if (alarmSoundPreviewTimer.current) window.clearTimeout(alarmSoundPreviewTimer.current);
      alarmSoundPreviewTimer.current = null;
      stopAlarmSound();
      setIsAlarmSoundPreviewing(false);
      return;
    }
    playAlarmSound(alarmSoundId);
    setIsAlarmSoundPreviewing(true);
    alarmSoundPreviewTimer.current = window.setTimeout(() => {
      stopAlarmSound();
      setIsAlarmSoundPreviewing(false);
      alarmSoundPreviewTimer.current = null;
    }, 6000);
  }

  async function openStopwatchFullscreen() {
    setStopwatchFullscreen(true);
    if (!nativeAndroid && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        reportError(err);
      }
    }
    if (!nativeAndroid && 'wakeLock' in navigator) {
      try {
        screenWakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        reportError(err);
      }
    }
  }

  async function closeStopwatchFullscreen() {
    setStopwatchFullscreen(false);
    if (!nativeAndroid && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        reportError(err);
      }
    }
  }

  function snoozeOneAlarm(id) {
    const at = Date.now() + 5 * 60 * 1000;
    snoozeAlarm(id, at);
    if (nativeAndroid) {
      const alarm = useAppStore.getState().alarms.find((row) => row.id === id);
      if (alarm) void scheduleNativeAlarm({ ...alarm, at }, lang).catch(reportError);
    }
    void syncAlarmUpdate(user, id, { at });
    setNotice(copy.alarmSnoozed);
    setError('');
  }

  function deleteAlarm(id) {
    removeAlarm(id);
    setMissedAlarms((rows) => rows.filter((alarm) => alarm.id !== id));
    if (nativeAndroid) void cancelNativeAlarm(id).catch(reportError);
    void syncAlarmDelete(user, id);
  }

  function snoozeFiringAlarm() {
    if (!firingAlarm) return;
    snoozeOneAlarm(firingAlarm.id);
    dismissAlarm();
  }

  async function acknowledgeMissedAlarm(id) {
    setMissedAlarms((rows) => rows.filter((alarm) => alarm.id !== id));
    await acknowledgeAlarm(user, id);
  }

  async function authenticate(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError('');
    const form = new FormData(formElement);
    const payload = {
      email: String(form.get('email') || ''),
      password: String(form.get('password') || ''),
    };
    if (registering) {
      payload.displayName = String(form.get('displayName') || '');
      payload.locale = String(form.get('locale') || 'bn');
      payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';
    }
    try {
      const result = await request(`/api/auth/${registering ? 'register' : 'login'}`, { method: 'POST', body: payload });
      const authenticatedUser = requireUserProfile(result);
      setUser(authenticatedUser);
      setProfileName(authenticatedUser.displayName);
      setProfileAvatarId(authenticatedUser.avatarId || 'sunrise');
      if (registering) setStoredLanguage(String(form.get('locale') || 'bn'));
      else if (!useAppStore.getState().language) setStoredLanguage(authenticatedUser.locale === 'en' ? 'en' : 'bn');
      setNotice('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function authenticateWithGoogle(credential) {
    setBusy(true);
    setError('');
    try {
      const result = await request('/api/auth/google', {
        method: 'POST',
        body: {
          credential,
          locale: lang,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka',
        },
      });
      const authenticatedUser = requireUserProfile(result);
      setUser(authenticatedUser);
      setProfileName(authenticatedUser.displayName);
      setProfileAvatarId(authenticatedUser.avatarId || 'sunrise');
      if (!useAppStore.getState().language) setStoredLanguage(authenticatedUser.locale === 'en' ? 'en' : 'bn');
      setNotice('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  const completeGoogleHandoff = useCallback(async (url) => {
    if (!nativeAndroid) return;
    let handoffCode;
    try {
      const link = new URL(url);
      if (link.protocol !== 'smartroutine:' || link.hostname !== 'auth' || link.pathname !== '/callback') return;
      handoffCode = link.searchParams.get('code') || '';
    } catch {
      return;
    }
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(handoffCode) || handledHandoffCodesRef.current.has(handoffCode)) return;
    handledHandoffCodesRef.current.add(handoffCode);

    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/api/auth/google/handoff/exchange', {
        method: 'POST',
        body: { code: handoffCode },
        locale: lang,
      });
      const authenticatedUser = requireUserProfile(result);
      setUser(authenticatedUser);
      setProfileName(authenticatedUser.displayName);
      setProfileAvatarId(authenticatedUser.avatarId || 'sunrise');
      if (!useAppStore.getState().language) setStoredLanguage(authenticatedUser.locale === 'en' ? 'en' : 'bn');
      setNotice('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }, [lang, nativeAndroid, reportError]);

  useEffect(() => {
    if (!nativeAndroid) return undefined;
    let disposed = false;
    let listener;
    App.addListener('appUrlOpen', ({ url }) => {
      void completeGoogleHandoff(url);
    }).then((handle) => {
      listener = handle;
      if (disposed) void handle.remove();
    }).catch(reportError);
    App.getLaunchUrl().then((launch) => {
      if (launch?.url) void completeGoogleHandoff(launch.url);
    }).catch(reportError);

    return () => {
      disposed = true;
      if (listener) void listener.remove();
    };
  }, [completeGoogleHandoff, nativeAndroid, reportError]);

  async function signOut() {
    setBusy(true);
    try {
      await request('/api/auth/logout', { method: 'POST', body: {} });
      clearOfflineUser();
      clearCachedRoutines(user?.id);
      setUser(null);
      setRoutines([]);
      setLessons([]);
      setDailyLesson(null);
      setDailyQuiz(null);
      setLesson(null);
      setStoryAward(null);
      setModel(null);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function addRoutine(event, onResetBuilder) {
    if (event?.preventDefault) event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const clientId = createUuidV4();
    const routine = {
      title: String(form.get('title') || '').trim(),
      startTime: String(form.get('startTime') || ''),
      endTime: String(form.get('endTime') || ''),
      category: String(form.get('category') || 'general'),
      priority: String(form.get('priority') || 'medium'),
      note: '',
      anchorHabit: String(form.get('anchorHabit') || '').trim(),
      isFrog: form.get('isFrog') === 'on',
      clientId,
    };
    if (!routine.title) return;

    // 0ms Optimistic UI update: immediately insert into state and reset form without freezing!
    const optimisticItem = {
      id: clientId,
      ...routine,
      completionStatus: null,
    };
    const previousRoutines = routines;
    const nextRoutines = [...routines, optimisticItem].sort((a, b) =>
      String(a.startTime || '').localeCompare(String(b.startTime || ''))
    );
    setRoutines(nextRoutines);
    saveCachedRoutines(user.id, todayInZone(user.timezone), nextRoutines);
    setError('');
    setNotice(lang === 'bn' ? `✅ সফলভাবে যোগ হয়েছে: "${routine.title}"` : `✅ Successfully added routine: "${routine.title}"`);
    if (typeof onResetBuilder === 'function') onResetBuilder();
    else formElement?.reset?.();
    setRoutineStartTime('');
    setRoutineEndTime('');
    setAnchorHabitInput('');

    // Sync in the background without locking the UI
    void enqueueAndFlush(user.id, { type: 'routine.create', data: routine })
      .then(() => loadRoutines(user))
      .catch((err) => {
        setRoutines(previousRoutines);
        reportError(err);
      });
  }

  async function removeRoutine(routineId) {
    // 0ms Optimistic UI removal: disappears immediately on tap!
    const previousRoutines = routines;
    const nextRoutines = routines.filter((r) => r.id !== routineId && r.clientId !== routineId);
    setRoutines(nextRoutines);
    saveCachedRoutines(user.id, todayInZone(user.timezone), nextRoutines);
    setError('');
    setNotice(copy.routineDeleted);
    if (nativeAndroid) void cancelNativeAlarm(`routine-${routineId}`).catch(() => {});

    // Sync deletion in background
    void enqueueAndFlush(user.id, { type: 'routine.delete', routineId })
      .then(() => loadRoutines(user))
      .catch((err) => {
        setRoutines(previousRoutines);
        reportError(err);
      });
  }

  async function setRoutineStatus(routineId, status) {
    // 0ms Optimistic UI status update
    const previousRoutines = routines;
    const previousStatus = routines.find((routine) => routine.id === routineId)?.completionStatus;
    const nextRoutines = routines.map((routine) =>
      routine.id === routineId ? { ...routine, completionStatus: status } : routine
    );
    setRoutines(nextRoutines);
    saveCachedRoutines(user.id, todayInZone(user.timezone), nextRoutines);
    setError('');
    setNotice(copy.completionSaved);
    if (status === 'done' && previousStatus !== 'done') {
      announceLearningActivity(50);
    }
    if (nativeAndroid && (status === 'done' || status === 'skipped')) {
      void cancelNativeAlarm(`routine-${routineId}`).catch(() => {});
    }

    // Background sync
    void enqueueAndFlush(user.id, {
      type: 'completion.set',
      data: { routineId, date: todayInZone(user.timezone), status },
    })
      .then((result) => {
        if (result.operationStatus === 'failed') {
          setRoutines(previousRoutines);
          setError(copy.completionRejected);
          return;
        }
        if (result.operationStatus === 'pending' || result.retryable || result.busy) {
          setNotice(copy.completionPending);
        }
        return loadRoutines(user);
      })
      .catch((err) => {
        setRoutines(previousRoutines);
        reportError(err);
      });
    return true;
  }

  async function finishRoutineTask(status) {
    if (!activeRoutineTask) return;
    const saved = await setRoutineStatus(activeRoutineTask.id, status);
    if (saved) setActiveRoutineTask(null);
  }

  async function changeConsent(granted) {
    setBusy(true);
    setError('');
    try {
      await request('/api/me/consents/model-training', {
        method: 'PUT',
        body: { granted, version: TRAINING_CONSENT_VERSION },
      });
      const result = await request('/api/me');
      setUser(requireUserProfile(result));
      setNotice('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function loadLesson(slug, focusTarget = 'story') {
    setLessonLoadingSlug(slug);
    setBusy(true);
    setError('');
    try {
      const loadedLesson = await getLessonDetails(slug);
      lessonFocusTargetRef.current = focusTarget;
      setLesson(loadedLesson);
      setStoryAward(null);
      setAnswers([]);
      setQuizResult(null);
      setOfflineCacheStatus('');
      if (getOfflineCacheConsent() === true) {
        setOfflineCacheStatus('গল্প ও শব্দার্থ অফলাইনে সংরক্ষণ করা হচ্ছে…');
        cacheOfflineLesson(loadedLesson, request)
          .then(async ({ lessonSaved, meaningsSaved, meaningsMissing }) => {
            if (!lessonSaved) return;
            setOfflineCacheStatus(meaningsMissing
              ? `গল্পটি অফলাইনে রাখা হয়েছে; ${meaningsSaved}টি শব্দার্থ সংরক্ষিত, ${meaningsMissing}টির অর্থ পাওয়া যায়নি।`
              : `গল্পটি অফলাইনে রাখা হয়েছে; ${meaningsSaved}টি শব্দার্থও সংরক্ষিত।`);
            setOfflineSavedLessons(await listOfflineLessons());
          })
          .catch((cacheError) => {
            setOfflineCacheStatus('অফলাইনে সংরক্ষণ সম্পূর্ণ হয়নি।');
            reportError(cacheError);
          });
      }
    } catch (err) {
      try {
        const cachedLesson = getOfflineCacheConsent() === true
          ? await getOfflineLesson(slug)
          : null;
        if (cachedLesson) {
          lessonFocusTargetRef.current = focusTarget;
          setLesson(cachedLesson);
          setAnswers([]);
          setQuizResult(null);
          setNotice('ইন্টারনেট সংযোগ নেই। এই গল্পটি এই ডিভাইস থেকে খোলা হয়েছে।');
        } else {
          reportError(err);
        }
      } catch (cacheError) {
        reportError(cacheError);
      }
    } finally {
      setLessonLoadingSlug('');
      setBusy(false);
    }
  }

  async function updateOfflineCacheConsent(allowed) {
    try {
      const wasAllowed = getOfflineCacheConsent() === true;
      if (allowed) await listOfflineLessons();
      setOfflineCacheConsent(allowed);
      setOfflineCacheAllowed(allowed);
      setOfflineConsentOpen(false);
      if (!allowed) {
        setOfflineCacheStatus('');
        if (wasAllowed) await clearOfflineStoryCache();
        setOfflineSavedLessons([]);
      }
    } catch (consentError) {
      reportError(consentError);
    }
  }

  useEffect(() => {
    if (!lesson) return;
    const targetId = lessonFocusTargetRef.current === 'quiz'
      ? 'published-lesson-quiz'
      : 'published-lesson-story';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [lesson]);

  async function submitQuiz() {
    if (!lesson || answers.length !== lesson.quiz.length) return;
    setBusy(true);
    setError('');
    try {
      const result = await request(`/api/lessons/${lesson.id}/attempts`, { method: 'POST', body: { answers } });
      setQuizResult(result);
      announceLearningActivity(result.earnedPoints);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function markPublishedLessonComplete() {
    if (!lesson || lesson.isOffline || storyCompletionBusy) return;
    setStoryCompletionBusy(true);
    setError('');
    try {
      const result = await request(`/api/lessons/${encodeURIComponent(lesson.id)}/read`, {
        method: 'POST',
        body: {},
      });
      setStoryAward({ lessonId: lesson.id, earnedPoints: result.earnedPoints || 0 });
      announceLearningActivity(result.earnedPoints);
    } catch (err) {
      reportError(err);
    } finally {
      setStoryCompletionBusy(false);
    }
  }

  async function markSpeakingStoryComplete(dailyLessonId) {
    if (
      !dailyLesson?._id
      || dailyLesson.isOffline
      || String(dailyLesson._id) !== String(dailyLessonId)
    ) return;

    const completionId = String(dailyLesson._id);
    const completions = speakingStoryCompletionsRef.current;
    if (completions.inFlight.has(completionId) || completions.completed.has(completionId)) return;

    completions.inFlight.add(completionId);
    try {
      const result = await request('/api/lessons/today/read', {
        method: 'POST',
        body: { dailyLessonId: completionId },
      });
      completions.completed.add(completionId);
      announceLearningActivity(result.earnedPoints);
    } catch (completionError) {
      reportError(completionError);
    } finally {
      completions.inFlight.delete(completionId);
    }
  }

  async function submitAccountAction(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (passwordAction === 'export') {
        const response = await request('/api/me/export', {
          method: 'POST', body: { password: actionPassword }, raw: true,
        });
        const data = await response.blob();
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'smart-routine-export.json';
        link.click();
        URL.revokeObjectURL(url);
        setNotice(copy.exportDone);
      } else {
        const confirmed = window.confirm(copy.deleteNow);
        if (!confirmed) return;
        await request('/api/me', { method: 'DELETE', body: { password: actionPassword } });
        clearOfflineUser();
        clearCachedRoutines(user?.id);
        setUser(null);
        setRoutines([]);
        setLessons([]);
        setDailyLesson(null);
        setDailyQuiz(null);
        setLesson(null);
        setNotice(copy.accountDeleted);
      }
      setPasswordAction('');
      setActionPassword('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main className="app-shell enter-up mx-auto my-6 max-w-md space-y-5 rounded-[2rem] p-4 sm:my-10 sm:p-7">
        <header className="app-hero relative space-y-4 overflow-hidden rounded-3xl p-6 sm:p-7">
          <div className="relative z-10 space-y-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.title}</h1>
            <p className="text-sm leading-relaxed text-white/85">{copy.useAccount}</p>
          </div>

          <div className="app-auth-controls relative z-10 flex items-center justify-between gap-2">
            {pwaInstallPrompt ? (
              <Button
                variant="primary"
                className="min-h-[40px] px-3 py-1.5 text-xs font-bold"
                onClick={async () => {
                  pwaInstallPrompt.prompt();
                  await pwaInstallPrompt.userChoice.catch(() => {});
                  setPwaInstallPrompt(null);
                }}
              >
                <span aria-hidden="true">📲</span>
                <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install'}</span>
              </Button>
            ) : null}
            <Button
              variant="secondary"
              className="language-toggle-button min-h-[40px] px-3 py-1.5 text-xs font-bold"
              aria-label={copy.languageToggle}
              title={copy.languageToggle}
              onClick={() => setStoredLanguage(lang === 'bn' ? 'en' : 'bn')}
            >
              <LanguageFlag lang={lang === 'bn' ? 'en' : 'bn'} />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </Button>
            <Button
              variant="secondary"
              className="icon-button min-h-[40px] min-w-[40px]"
              aria-label={theme === 'dark' ? copy.themeLight : copy.themeDark}
              title={theme === 'dark' ? copy.themeLight : copy.themeDark}
              onClick={toggleTheme}
            >
              <span key={theme} className="coin-flip" aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </Button>
          </div>
        </header>

        <Card as="form" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" className="surface-card glass-panel glow-border enter-up space-y-5 rounded-3xl p-6 sm:p-7" onSubmit={authenticate}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gold/25 bg-paper/60 p-1.5">
            <button
              type="button"
              onClick={() => { setRegistering(false); setError(''); }}
              className={`min-h-[42px] rounded-xl text-sm font-bold transition ${!registering ? 'bg-sapphire text-on-sapphire tab-bounce shadow-[0_0_12px_rgba(96,165,250,0.5)]' : 'text-ink/75 hover:text-ink'}`}
            >
              {copy.login}
            </button>
            <button
              type="button"
              onClick={() => { setRegistering(true); setError(''); }}
              className={`min-h-[42px] rounded-xl text-sm font-bold transition ${registering ? 'bg-sapphire text-on-sapphire tab-bounce shadow-[0_0_12px_rgba(96,165,250,0.5)]' : 'text-ink/75 hover:text-ink'}`}
            >
              {copy.register}
            </button>
          </div>

          <div className="space-y-4">
            {registering ? (
              <>
                <label className="block text-sm font-semibold">
                  {copy.name}
                  <input name="displayName" required maxLength="60" placeholder={lang === 'bn' ? 'আপনার নাম' : 'Your name'} className="mt-1.5 block w-full rounded-xl border border-gold/25 bg-paper/70 p-3 text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30" />
                </label>
                <label className="block text-sm font-semibold">
                  {copy.locale}
                  <select name="locale" value={lang} onChange={(event) => setStoredLanguage(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-gold/25 bg-paper/70 p-3 text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30">
                    <option value="bn">বাংলা (Bangla)</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </>
            ) : null}

            <label className="block text-sm font-semibold">
              {copy.email}
              <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="mt-1.5 block w-full rounded-xl border border-gold/25 bg-paper/70 p-3 text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30" />
            </label>

            <PasswordField
              label={copy.password}
              copy={copy}
              name="password"
              required
              maxLength="128"
              autoComplete={registering ? 'new-password' : 'current-password'}
              hint={registering ? copy.passwordHint : undefined}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3.5 py-2.5 text-xs font-semibold text-rose-300">
              ⚠️ {error}
            </p>
          ) : null}

          <div className="space-y-3 pt-1">
            <Button type="submit" disabled={busy} className="min-h-[48px] w-full text-base font-bold">
              {registering ? copy.create : copy.signIn}
            </Button>

            <p className="text-center text-xs text-ink/75">
              <button type="button" className="font-semibold text-gold-soft underline hover:text-gold" onClick={() => { setRegistering(!registering); setError(''); }}>
                {registering ? copy.switchLogin : copy.switchRegister}
              </button>
            </p>
          </div>

          {(googleClientId || nativeAndroid) ? (
            <div className="space-y-3 border-t border-gold/20 pt-4">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-ink/60">{copy.googleSignIn}</p>
              <GoogleSignInButton
                clientId={googleClientId}
                lang={lang}
                disabled={busy}
                nativeAndroid={nativeAndroid}
                onCredential={authenticateWithGoogle}
                onError={reportError}
              />
            </div>
          ) : null}
        </Card>
        {offlineSavedLessons.length ? (
          <Card className="surface-card glass-panel glow-border space-y-4 rounded-3xl p-5">
            <div>
              <h2 className="text-lg font-extrabold text-ink">অফলাইনে সংরক্ষিত গল্প</h2>
              <p className="mt-1 text-sm text-ink/75">অ্যাকাউন্টে সাইন ইন না করেও এই ডিভাইসে রাখা গল্প পড়তে পারবেন।</p>
            </div>
            <ul className="space-y-2">
              {offlineSavedLessons.map((savedLesson) => (
                <li key={savedLesson.slug}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-sapphire/30 bg-paper/70 p-3 text-left font-semibold text-ink hover:border-sapphire"
                    onClick={() => setOfflineLessonPreview(savedLesson)}
                  >
                    {localized(savedLesson.title, 'en')}
                  </button>
                </li>
              ))}
            </ul>
            {offlineLessonPreview ? (
              <div className="space-y-3 border-t border-gold/20 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-ink">{localized(offlineLessonPreview.title, 'en')}</h3>
                  <Button
                    variant="secondary"
                    className="min-h-[40px] px-3"
                    onClick={() => setOfflineLessonPreview(null)}
                  >
                    বন্ধ করুন
                  </Button>
                </div>
                <AudioDramaPlayer
                  title={localized(offlineLessonPreview.title, 'en')}
                  slug={offlineLessonPreview.slug}
                  content={localized(offlineLessonPreview.body, 'en')}
                  practiceContent={localized(offlineLessonPreview.body, 'en')}
                  vocabulary={offlineLessonPreview.vocabulary || []}
                  lang={lang}
                />
                {offlineLessonPreview.quiz?.questions?.length ? (
                  <section aria-label={lang === 'bn' ? 'অফলাইন কুইজ প্রশ্ন' : 'Offline quiz questions'} className="space-y-3">
                    <h4 className="font-bold text-ink">{lang === 'bn' ? 'অফলাইন কুইজ' : 'Offline quiz'}</h4>
                    <p className="text-sm text-ink/70">
                      {lang === 'bn'
                        ? 'প্রশ্নগুলো অফলাইনে পড়তে পারবেন; উত্তর জমা দিতে ইন্টারনেট লাগবে।'
                        : 'Read the questions offline; an internet connection is needed to submit answers.'}
                    </p>
                    <ol className="space-y-3">
                      {offlineLessonPreview.quiz.questions.map((question, index) => (
                        <li key={`${offlineLessonPreview.slug}-quiz-${index}`} className="rounded-xl border border-sapphire/20 bg-paper/70 p-3">
                          <p className="font-semibold text-ink">{index + 1}. {localized(question.text, 'en')}</p>
                          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/80">
                            {question.options?.map((option, optionIndex) => (
                              <li key={`${offlineLessonPreview.slug}-quiz-${index}-option-${optionIndex}`}>
                                {localized(option.text, 'en')}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </div>
            ) : null}
          </Card>
        ) : null}
      </main>
    );
  }

  const renderAppHeaderControls = () => (
    <div className="app-header-controls">
      <Button
        variant={tab === 'settings' ? 'primary' : 'secondary'}
        className={`tab-button app-header-settings ${tab === 'settings' ? 'tab-button-active app-header-settings-active' : ''}`}
        aria-label={copy.settings}
        title={copy.settings}
        aria-current={tab === 'settings' ? 'page' : undefined}
        onClick={() => setTab('settings')}
      >
        <span className="tab-icon" aria-hidden="true">⚙️</span>
      </Button>
      <Button
        variant={tab === 'focus' ? 'primary' : 'secondary'}
        className={`tab-button app-header-focus ${tab === 'focus' ? 'tab-button-active app-header-focus-active' : ''}`}
        aria-label={lang === 'bn' ? 'ফোকাস ও অ্যালার্ম' : 'Focus and alarms'}
        title={lang === 'bn' ? 'ফোকাস ও অ্যালার্ম' : 'Focus and alarms'}
        aria-current={tab === 'focus' ? 'page' : undefined}
        onClick={() => setTab('focus')}
      >
        <span className="tab-icon" aria-hidden="true">⏱️</span>
      </Button>
      <Button
        variant="secondary"
        className="tab-button app-header-language"
        aria-label={copy.languageToggle}
        title={copy.languageToggle}
        onClick={() => setStoredLanguage(lang === 'bn' ? 'en' : 'bn')}
      >
        <span className="tab-icon" aria-hidden="true">
          <LanguageFlag lang={lang === 'bn' ? 'en' : 'bn'} />
        </span>
        <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
      </Button>
      <Button
        variant="secondary"
        className={`tab-button app-header-leaderboard ${tab === 'leaderboard' ? 'tab-button-active' : ''}`}
        aria-label={copy.leaderboard}
        title={copy.leaderboard}
        aria-current={tab === 'leaderboard' ? 'page' : undefined}
        onClick={() => setTab('leaderboard')}
      >
        <span className="tab-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="leaderboard-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8m-4-4v4m-7-17h14v5a7 7 0 0 1-14 0V4Z" />
            <path d="M5 6H3v2a5 5 0 0 0 5 5m11-7h2v2a5 5 0 0 1-5 5" />
          </svg>
        </span>
      </Button>
      <Button
        variant="secondary"
        className="tab-button app-header-theme"
        aria-label={theme === 'dark' ? copy.themeLight : copy.themeDark}
        title={theme === 'dark' ? copy.themeLight : copy.themeDark}
        aria-pressed={theme === 'dark'}
        onClick={toggleTheme}
      >
        <span key={theme} className="tab-icon coin-flip" aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
      </Button>
    </div>
  );

  return (
    <main lang={lang} className={`app-shell app-shell-main mx-auto my-5 max-w-6xl space-y-5 rounded-[2rem] p-3 sm:my-8 sm:p-7${immersiveTab ? ' app-shell-immersive' : ''}`}>
      {immersiveTab ? (
        <Button
          type="button"
          variant="secondary"
          className="app-immersive-back"
          aria-label={lang === 'bn' ? 'আজকের রুটিনে ফিরুন' : "Return to today's routine"}
          title={lang === 'bn' ? 'আজকের রুটিনে ফিরুন' : "Return to today's routine"}
          onClick={() => setTab('today')}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5m7 7-7-7 7-7" />
          </svg>
        </Button>
      ) : null}
      {!immersiveTab ? (
      <header className="app-hero enter-up flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="relative z-10 w-full">
          <div className="app-hero-heading-row">
            <div className="app-tabs app-header-controls-mobile">{renderAppHeaderControls()}</div>
          </div>
        </div>
      </header>
      ) : null}
      {!immersiveTab ? <SyncStatus userId={user.id} lang={lang} /> : null}
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-400 bg-rose-500/15 px-4 py-3 text-sm font-bold text-rose-300 shadow-lg">
          <span>{error.startsWith('❌') ? error : `❌ ${error}`}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label={lang === 'bn' ? 'বার্তা বন্ধ করুন' : 'Dismiss error'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-rose-400/50 p-2 text-sm font-extrabold text-rose-300 hover:bg-rose-500/20"
          >
            ✕
          </button>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-sapphire bg-sapphire/15 px-4 py-3 text-sm font-bold text-sapphire shadow-lg">
          <span>{notice.startsWith('✅') ? notice : `✅ ${notice}`}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label={lang === 'bn' ? 'বার্তা বন্ধ করুন' : 'Dismiss notice'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-sapphire/50 p-2 text-sm font-extrabold text-sapphire hover:bg-sapphire/20"
          >
            ✕
          </button>
        </div>
      ) : null}
      {firingAlarm ? (
        <Card className="alarm-banner flex flex-col gap-4" role="alert">
          <p className="text-xl font-bold sm:text-2xl">
            <span aria-hidden="true">🔔</span> {copy.alarmRinging}:{' '}
            <strong className="rounded-lg bg-gold/20 px-2 py-1 text-gold-soft">{firingAlarm.label || copy.alarmTime}</strong>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={dismissAlarm} className="min-h-[52px] text-lg"><span aria-hidden="true">⏹️</span><span className="ml-2">{copy.stopAlarm}</span></Button>
            <Button variant="secondary" onClick={snoozeFiringAlarm} className="min-h-[52px] text-lg"><span aria-hidden="true">⏰</span><span className="ml-2">{copy.snoozeAlarm}</span></Button>
          </div>
        </Card>
      ) : null}
      <nav className="app-tabs" aria-label={copy.title}>
        {[
          ['today', '🌤️', copy.today, lang === 'bn' ? 'আজ' : 'Today'],
          ['plan', '🗓️', lang === 'bn' ? 'পরিকল্পনা' : 'Plan', lang === 'bn' ? 'পরিকল্পনা' : 'Plan'],
          ['lessons', '📚', copy.lessons, lang === 'bn' ? 'পাঠ' : 'Learn'],
          ['speaking', '🎙️', lang === 'bn' ? 'কথা বলা শিখুন' : 'Learn to speak', lang === 'bn' ? 'কথা' : 'Speak'],
          ['grammar', '🧩', lang === 'bn' ? 'Building · ইংরেজি বাক্য অনুশীলন' : 'Building · English practice', 'Building'],
        ].map(([key, icon, label, shortLabel], index) => (
          <Button key={key} variant={tab === key ? 'primary' : 'secondary'} style={{ '--enter-delay': `${index * 60}ms` }} className={`tab-button enter-up ${tab === key ? 'tab-button-active' : ''}`} aria-label={label} title={label} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
            <span className={`tab-icon tab-icon-${key}`} aria-hidden="true">
              {icon}
            </span>
            <span className="tab-label-desktop">{shortLabel}</span>
            <span className="tab-label-mobile" aria-hidden="true">{shortLabel}</span>
          </Button>
        ))}
        <div className="app-tabs-utilities" aria-label={lang === 'bn' ? 'অতিরিক্ত নিয়ন্ত্রণ' : 'More controls'}>
          {renderAppHeaderControls()}
        </div>
      </nav>

      <aside className="celestial-desktop-rail" aria-label={lang === 'bn' ? 'আজকের অভ্যাসের নক্ষত্রমণ্ডল' : "Today's habit constellation"}>
        <h2>{lang === 'bn' ? 'আজকের ধারা' : 'Today’s chain'}</h2>
        <p className="celestial-rail-caption">
          {lang === 'bn' ? 'প্রতিটি সম্পন্ন কাজ একটি নক্ষত্র জ্বালায়' : 'Each completed routine lights a star.'}
        </p>
        {routines.length ? (
          <svg
            className="celestial-rail-map"
            viewBox="0 0 218 72"
            role="img"
            aria-label={lang === 'bn'
              ? `${routines.filter((routine) => routine.completionStatus === 'done').length} টি কাজ সম্পন্ন`
              : `${routines.filter((routine) => routine.completionStatus === 'done').length} routines completed`}
          >
            {DESKTOP_CONSTELLATION_POINTS.slice(0, Math.min(routines.length, DESKTOP_CONSTELLATION_POINTS.length) - 1).map(([x1, y1], index) => {
              const [x2, y2] = DESKTOP_CONSTELLATION_POINTS[index + 1];
              const segmentLit = routines[index]?.completionStatus === 'done'
                && routines[index + 1]?.completionStatus === 'done';
              return (
                <line
                  key={`rail-link-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={`constellation-link ${segmentLit ? 'is-lit' : ''}`}
                />
              );
            })}
            {routines.slice(0, DESKTOP_CONSTELLATION_POINTS.length).map((routine, index) => {
              const [cx, cy] = DESKTOP_CONSTELLATION_POINTS[index];
              return (
                <circle
                  key={routine.id}
                  cx={cx}
                  cy={cy}
                  r="3.5"
                  className={`constellation-node ${routine.completionStatus === 'done' ? 'is-lit' : ''}`}
                />
              );
            })}
          </svg>
        ) : (
          <div className="celestial-empty-map" aria-hidden="true">✧ · ✦ · ✧</div>
        )}
        <p className="celestial-rail-total">
          {lang === 'bn'
            ? `${routines.filter((routine) => routine.completionStatus === 'done').length} / ${routines.length} সম্পন্ন`
            : `${routines.filter((routine) => routine.completionStatus === 'done').length} of ${routines.length} complete`}
        </p>
      </aside>

      {tab === 'leaderboard' ? <div className="tab-enter"><LeaderboardPanel lang={lang} /></div> : null}

      {tab === 'speaking' ? (
        <div className="tab-enter">
          <SpeakingSituations
            lang={lang}
            dailyLesson={dailyLesson}
            onStoryComplete={markSpeakingStoryComplete}
          />
        </div>
      ) : null}

      {tab === 'settings' ? (
        <section className="tab-enter space-y-4">
          <h2 className="section-heading">{lang === 'bn' ? 'পরিসংখ্যান ও অগ্রগতি' : 'Statistics and progress'}</h2>
          <GamificationBar lang={lang} userId={user.id} />
          <RoutineDashboard lang={lang} userId={user.id} />
          <BadgesShowcase lang={lang} />
          <HeatmapGrid lang={lang} />
          <HabitCirclesCard lang={lang} />
        </section>
      ) : null}

      {tab === 'grammar' ? <div className="tab-enter"><GrammarLessons lang={lang} stories={grammarStorySources} /></div> : null}

      {tab === 'today' ? (
        <section className="tab-enter today-screen space-y-4">
          <TodayProgressCard
            lang={lang}
            userId={user.id}
            routines={routines}
            onScrollToAddRoutine={() => setTab('plan')}
            onScrollToAlarms={() => setTab('focus')}
          />

          <Card className="surface-card glass-panel glow-border flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="font-bold text-ink">{copy.voiceBriefing}</h2>
              <p className="text-sm text-ink/70">
                {lang === 'bn' ? 'আজকের রুটিনের সংক্ষিপ্ত কণ্ঠস্বরের বিবরণ শুনুন' : 'Listen to a spoken overview of today’s routines'}
              </p>
            </div>
            <Button variant="secondary" className="settings-action-button" onClick={openVoiceBriefing}>
              <span aria-hidden="true">🎧</span><span>{copy.voiceBriefing}</span>
            </Button>
          </Card>

          {reminders.length ? (
            <Card className="border-gold bg-gold-soft glass-panel" role="status">
              <h2 className="font-bold">{copy.reminder}</h2>
              <ul>{reminders.map((routine) => <li key={routine.id}>{routine.title} · {routine.startTime}</li>)}</ul>
            </Card>
          ) : null}

          {focusRoutines.length ? (
            <Card className="surface-card glass-panel glow-border space-y-2">
              <h2 className="section-heading">{copy.focus20}</h2>
              <p className="text-sm opacity-75">{copy.focus20Help}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {focusRoutines.map((routine) => (
                  <li key={routine.id} className="focus-routine-row">
                    <span className="min-w-0">
                      <span className="block font-semibold">{routine.title}</span>
                      {routine.isFrog ? <span className="important-task-tag">{copy.importantTag}</span> : null}
                    </span>
                    <span className="shrink-0 text-sm">{routine.startTime}–{routine.endTime}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="surface-card glass-panel glow-border space-y-4">
            <h2 className="section-heading"><span aria-hidden="true">🌤️</span> {copy.today}</h2>
            {routines.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gold/30 bg-gold/5 p-8 text-center sm:p-10">
                <span className="text-4xl sm:text-5xl" aria-hidden="true">🌱</span>
                <h3 className="mt-3 text-lg font-bold text-ink sm:text-xl">
                  {lang === 'bn' ? 'আজকের কোনো রুটিন এখনো যোগ করা হয়নি' : 'No routines planned for today yet'}
                </h3>
                <p className="mt-1.5 max-w-md text-sm text-ink/70">
                  {lang === 'bn'
                    ? 'সহজ কিছু অভ্যাস ও লক্ষ্য দিয়ে দিনটি সাজান। টেমপ্লেট থেকে দ্রুত বেছে নিতে পারেন অথবা নিজের মতো তৈরি করতে পারেন।'
                    : 'Start organizing your day with simple habits and goals. Pick from quick templates or create your custom routine.'}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="primary"
                    className="min-h-[44px] px-5 py-2.5 text-sm font-bold shadow-md"
                    onClick={() => setTab('plan')}
                  >
                    <span aria-hidden="true" className="mr-1.5">➕</span>
                    <span>{lang === 'bn' ? 'প্রথম রুটিন যোগ করুন' : 'Add First Routine'}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {routines.map((routine) => (
                  <li key={routine.id} className="routine-tile flex flex-wrap items-center justify-between gap-3 rounded-2xl border-b border-sapphire/20 p-4">
                    <div>
                      <h3 className="font-semibold"><span aria-hidden="true">✦ </span>{routine.title}</h3>
                      <p className="mt-1 text-sm opacity-75"><span aria-hidden="true">🕰️ </span>{formatNaturalTime(routine.startTime, lang)} – {formatNaturalTime(routine.endTime, lang)} · {routine.category} · {copy[routine.priority] || routine.priority}</p>
                      {routine.anchorHabit ? <p className="mt-0.5 text-xs text-sapphire"><span aria-hidden="true">⚓ </span>{routine.anchorHabit}</p> : null}
                      {routine.isFrog ? <span className="important-task-tag">{copy.importantTag}</span> : null}
                      {routine.completionStatus ? <StatusChip lang={lang} status={routine.completionStatus} /> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="min-h-[44px] px-3.5 text-xs font-bold sm:text-sm"
                        variant="primary"
                        disabled={busy}
                        onClick={() => setActiveRoutineTask(routine)}
                      >
                        <span aria-hidden="true">▶</span>
                        <span className="ml-1.5">{lang === 'bn' ? 'শুরু করুন' : 'Start task'}</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => setReplanRoutine(routine)}
                        title={lang === 'bn' ? 'সময় কম? ৫ মিনিটের সংক্ষেপ বিকল্প' : 'Short on time? 5-min version'}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gold bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold-soft hover:bg-gold/20"
                      >
                        <span aria-hidden="true">⚡</span>
                        <span>{lang === 'bn' ? '৫ মিনিট' : '5 min'}</span>
                      </button>
                      <Button
                        className="min-h-[44px] px-3.5 text-xs font-bold sm:text-sm"
                        variant={routine.completionStatus === 'done' ? 'primary' : 'secondary'}
                        aria-label={copy.done}
                        title={copy.done}
                        disabled={busy}
                        onClick={() => setRoutineStatus(routine.id, 'done')}
                      >
                        <span aria-hidden="true">✅</span>
                        <span className="ml-1.5">{copy.done}</span>
                      </Button>
                      {[
                        ['missed', '❌'], ['skipped', '⏭️'],
                      ].map(([status, icon]) => (
                        <Button
                          key={status}
                          className="icon-button inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
                          variant={routine.completionStatus === status ? 'primary' : 'secondary'}
                          aria-label={copy[status]}
                          title={copy[status]}
                          disabled={busy}
                          onClick={() => setRoutineStatus(routine.id, status)}
                        >
                          <span aria-hidden="true">{icon}</span>
                        </Button>
                      ))}
                      <Button
                        variant="secondary"
                        className="icon-button inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink/60 hover:text-rose-400"
                        aria-label={copy.delete}
                        title={copy.delete}
                        disabled={busy}
                        onClick={() => removeRoutine(routine.id)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </section>
      ) : null}

      {tab === 'plan' ? (
        <section className="tab-enter space-y-4">
          <div className="space-y-2">
            <p className="eyebrow">{lang === 'bn' ? 'ধাপ ১ · রুটিন তৈরি' : 'STEP 1 · CREATE A ROUTINE'}</p>
            <AddRoutineBuilderCard
              lang={lang}
              copy={copy}
              busy={busy}
              onSubmitRoutine={addRoutine}
            />
          </div>
          <details className="group">
            <summary className="cursor-pointer rounded-2xl border border-gold/25 bg-paper/80 px-4 py-3 font-extrabold text-ink shadow-sm">
              {lang === 'bn' ? 'লক্ষ্য থেকে রুটিন বানানোর সহায়ক' : 'Goal-to-routine helper'}
            </summary>
            <div className="pt-3">
              <GoalToRoutine lang={lang} userId={user.id} onRoutinesAdded={() => loadRoutines(user).catch(reportError)} />
            </div>
          </details>
          <Card className="surface-card glass-panel glow-border p-4">
            <h2 className="section-heading"><span aria-hidden="true">📅</span> {lang === 'bn' ? 'ধাপ ২ · মাসিক ক্যালেন্ডার' : 'STEP 2 · MONTHLY CALENDAR'}</h2>
            <div className="mt-4 space-y-4 border-t border-sapphire/15 pt-3">
              <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{englishMonth}</p>
                {banglaMonthRange ? <p className="text-sm opacity-75">{banglaMonthRange.first} – {banglaMonthRange.last}</p> : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  aria-label={copy.previousMonth}
                  title={copy.previousMonth}
                  onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}
                >‹</Button>
                <Button
                  variant="secondary"
                  aria-label={copy.nextMonth}
                  title={copy.nextMonth}
                  onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}
                >›</Button>
              </div>
            </header>
            <div className="calendar-weekdays grid grid-cols-7 gap-1 text-center text-xs font-semibold sm:text-sm">
              {copy.weekdays.map((weekday) => <div key={weekday} className="py-1">{weekday}</div>)}
            </div>
            <div className="calendar-month-grid grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} aria-hidden="true" className="calendar-empty-day min-h-16 rounded-lg" />;
                const isDayOff = day.weekend || Boolean(day.holidayName);
                const holidayName = day.holidayName?.[lang] || day.holidayName?.en || day.holidayName?.bn;
                const dayOffLabel = holidayName || (day.weekend ? copy.weeklyDayOff : '');
                return (
                  <div
                    key={day.date}
                    title={dayOffLabel || day.date}
                    aria-label={`${day.date}${day.bengaliDay ? `, ${day.bengaliDay}` : ''}${dayOffLabel ? `, ${dayOffLabel}` : ''}`}
                    aria-current={day.date === calendarToday ? 'date' : undefined}
                    className={`calendar-day ${isDayOff ? 'calendar-day-off' : ''} ${day.date === calendarToday ? 'calendar-day-today' : ''}`}
                  >
                    <div className="calendar-day-number">
                      <span>{day.day}</span>{day.bengaliDay ? <span className="calendar-day-bengali-number text-[10px] opacity-70 sm:text-xs">{day.bengaliDay}</span> : null}
                    </div>
                    {dayOffLabel ? <p className="calendar-day-label">{dayOffLabel}</p> : null}
                  </div>
                );
              })}
            </div>
            <div className="calendar-legend" aria-label={copy.calendarLegend}>
              <span><i className="calendar-legend-swatch" aria-hidden="true" />{copy.regularDay}</span>
              <span><i className="calendar-legend-swatch calendar-legend-swatch-off" aria-hidden="true" />{copy.holidayDay}</span>
              <span><i className="calendar-legend-swatch calendar-legend-swatch-today" aria-hidden="true" />{copy.todayLabel}</span>
            </div>
            <p className="text-sm opacity-75">{copy.holidayCalendarHelp}</p>
            {calendarLoading ? <p role="status">{copy.holidayCalendarLoading}</p> : null}
            {calendarError ? <p role="alert">{calendarError || copy.holidayCalendarError}</p> : null}
            <div className="space-y-2 border-t border-sapphire/15 pt-3">
              <p className="text-sm opacity-75">{copy.notificationDays}</p>
              <Button
                variant={holidayNotificationsEnabled ? 'secondary' : 'primary'}
                disabled={holidayPushBusy}
                onClick={holidayNotificationsEnabled ? disableHolidayNotifications : enableHolidayNotifications}
              >
                {holidayPushBusy ? copy.loading : holidayNotificationsEnabled ? copy.disableHolidayNotifications : copy.enableHolidayNotifications}
              </Button>
            </div>
            </div>
          </Card>
          <Card className="surface-card glass-panel glow-border p-4">
            <h2 className="section-heading"><span aria-hidden="true">💡</span> {lang === 'bn' ? 'ধাপ ৩ · ধারণা ও টেমপ্লেট' : 'STEP 3 · IDEAS & TEMPLATES'}</h2>
            <div className="mt-4 space-y-4 pt-3 border-t border-sapphire/15">
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-between text-left"
                onClick={() => setTab('speaking')}
              >
                <span>{lang === 'bn' ? '🎙️ গল্পে কথা বলার অনুশীলন' : '🎙️ Practice speaking with stories'}</span>
                <span aria-hidden="true">→</span>
              </Button>
              <TemplatePicker lang={lang} userId={user.id} onRoutineAdded={() => loadRoutines(user).catch(reportError)} />
            </div>
          </Card>
        </section>
      ) : null}

      {tab === 'focus' ? (
        <section className="tab-enter space-y-4">
            <Card className="surface-card glass-panel glow-border space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="section-heading"><span aria-hidden="true">⏱️</span> {copy.stopwatch}</h2>
                <StopwatchReadout className="stopwatch-display" />
              </div>
              <p className="opacity-75">{copy.focus}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={openStopwatchFullscreen}>
                  <span aria-hidden="true">⛶</span><span className="ml-2">{copy.expandStopwatch}</span>
                </Button>
                {stopwatchStartedAt === null
                  ? <Button onClick={() => startStopwatch()}><span aria-hidden="true">▶️</span><span className="ml-2">{copy.startTimer}</span></Button>
                  : <Button variant="secondary" onClick={() => stopStopwatch()}><span aria-hidden="true">⏸️</span><span className="ml-2">{copy.pauseTimer}</span></Button>}
                <Button variant="secondary" onClick={() => resetStopwatch()}><span aria-hidden="true">↻</span><span className="ml-2">{copy.resetTimer}</span></Button>
              </div>
            </Card>
          <section className="space-y-4">
            <Card className="surface-card glass-panel glow-border space-y-4">
              <h2 className="section-heading"><span aria-hidden="true">🔔</span> {copy.alarmTitle}</h2>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={scheduleAlarm}>
                <label className="block">{copy.alarmTime}<input type="datetime-local" value={alarmTime} min={localDateTimeValue(new Date(Date.now() + 60_000))} onChange={(event) => setAlarmTime(event.target.value)} required className="polished-input mt-1 block w-full p-3" /></label>
                <label className="block">{copy.alarmName}<input value={alarmName} onChange={(event) => setAlarmName(event.target.value)} maxLength={60} placeholder={copy.alarmName} className="polished-input mt-1 block w-full p-3" /></label>
                <div className="sm:col-span-2">
                  <Button type="submit" className="min-h-[52px] w-full text-lg"><span aria-hidden="true">⏰</span><span className="ml-2">{copy.addAlarm}</span></Button>
                </div>
              </form>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="block">{copy.alarmSound}
                  <select
                    className="polished-input mt-1 block min-h-[48px] w-full"
                    value={alarmSoundId}
                    onChange={(event) => {
                      setAlarmSoundId(event.target.value);
                      if (isAlarmSoundPreviewing) {
                        playAlarmSound(event.target.value);
                      }
                    }}
                  >
                    {ALARM_SOUNDS.map((sound) => (
                      <option key={sound.id} value={sound.id}>{lang === 'bn' ? sound.bn : sound.en}</option>
                    ))}
                  </select>
                </label>
                <Button type="button" variant="secondary" className="min-h-[48px]" disabled={Boolean(firingAlarm)} onClick={previewAlarmSound}>
                  {isAlarmSoundPreviewing ? copy.stopAlarmSound : copy.previewAlarmSound}
                </Button>
                <p className="text-sm opacity-75 sm:col-span-2">{copy.alarmSoundHelp}</p>
              </div>
              <p className="text-sm opacity-75">{nativeAndroid ? copy.nativeAlarmNote : copy.voiceAlarmNote}</p>
              <div className="flex flex-col gap-2">
                {pushAlarmReady || (!nativeAndroid && browserNotificationPermission === 'granted') ? (
                  <p role="status" className="text-sm font-semibold text-sapphire">🔔 {nativeAndroid ? copy.nativeAlarmEnabled : pushAlarmReady ? copy.alarmPushOn : copy.browserNotificationsOn}</p>
                ) : (
                  <Button type="button" onClick={enableClosedAppAlerts} className="min-h-[52px] w-full text-lg">
                    {nativeAndroid ? copy.enableNativeAlarm : copy.enableClosedAppAlerts}
                  </Button>
                )}
                {!nativeAndroid && !pushAlarmReady && browserNotificationPermission === 'granted' ? (
                  <>
                    <p className="text-sm opacity-75">{copy.alarmPushOff}</p>
                    <Button type="button" variant="secondary" onClick={enableClosedAppAlerts} className="min-h-[48px]">
                      {copy.enableClosedAppAlerts}
                    </Button>
                  </>
                ) : null}
                {!nativeAndroid && browserNotificationPermission === 'denied' ? <p role="alert" className="text-sm text-gold">{copy.browserNotificationsBlocked}</p> : null}
                {!nativeAndroid && browserNotificationPermission === 'unsupported' ? <p role="status" className="text-sm">{copy.browserNotificationsUnsupported}</p> : null}
              </div>
              {!nativeAndroid && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' ? <p role="status" className="text-sm text-gold">{copy.alarmPermissionDenied}</p> : null}
              {missedAlarms.length ? (
                <div className="rounded-xl border border-gold/50 bg-gold/10 p-3" role="status">
                  <p className="font-bold">🔔 {copy.missedAlarms} ({missedAlarms.length})</p>
                  <ul className="mt-2 space-y-2">
                    {missedAlarms.map((alarm) => (
                      <li key={alarm.id} className="flex items-center justify-between gap-3">
                        <span><strong>{alarm.label || copy.alarmTime}</strong><span className="ml-2 text-sm opacity-70">{new Date(alarm.at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en')}</span></span>
                        <Button variant="secondary" className="min-h-[44px]" onClick={() => acknowledgeMissedAlarm(alarm.id)}>{copy.acknowledgeAlarm}</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="space-y-2">
                {alarms.length ? alarms.map((alarm) => (
                  <li key={alarm.id} className="alarm-row alarm-ring flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                    <span><strong>{alarm.label || copy.alarmTitle}</strong><span className="ml-2 text-sm opacity-70">{copy.setFor} {new Date(alarm.at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en')}</span>{alarm.firedAt ? <span className="ml-2 text-xs text-gold">{copy.alarmDone}</span> : null}</span>
                    <span className="flex shrink-0 gap-2">
                      <Button variant="secondary" className="min-h-[44px] px-3" aria-label={`${copy.snoozeAlarm}: ${alarm.label || copy.alarmTime}`} title={copy.snoozeAlarm} onClick={() => snoozeOneAlarm(alarm.id)}>⏰</Button>
                      <Button variant="secondary" className="icon-button min-h-[44px]" aria-label={copy.removeAlarm} title={copy.removeAlarm} onClick={() => deleteAlarm(alarm.id)}>✕</Button>
                    </span>
                  </li>
                )) : <li className="text-sm opacity-70">{copy.noAlarms}</li>}
              </ul>
            </Card>
          </section>
        </section>
      ) : null}

      {tab === 'lessons' ? (
        <section className="tab-enter space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {offlineCacheStatus ? <p role="status" className="text-sm text-ink/80">{offlineCacheStatus}</p> : <span />}
            <Button
              variant="secondary"
              className="min-h-[40px] text-xs font-bold"
              onClick={() => setOfflineConsentOpen(true)}
            >
              {offlineCacheAllowed ? 'অফলাইন সংরক্ষণ সেটিংস' : 'অফলাইনে পড়ার জন্য সংরক্ষণ'}
            </Button>
          </div>
          {dailyLesson ? <DailyLessonCard dailyLesson={dailyLesson} quiz={dailyQuiz} lang={lang} collapsible trackLearning /> : null}
          {lessons.length ? (
            <div className="space-y-4">
              <Card className={`surface-card glass-panel glow-border ${lesson || lessonLoadingSlug ? 'lesson-catalog-reading' : ''} space-y-3 p-4 sm:p-6`}>
                <h2 className="text-xl font-extrabold text-gold-soft">{copy.lessons}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {lessons.map((item) => (
                    <div key={item.slug} className="flex flex-col justify-between gap-3 rounded-2xl border border-sapphire/25 bg-gradient-to-br from-paper via-paper to-sapphire/5 p-4 shadow-sm transition hover:border-gold/50 hover:shadow-md">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-sapphire">
                          📖 {lang === 'bn' ? 'ইংরেজি গল্প · কুইজ' : 'English story · quiz'}
                        </p>
                        <h3 className="mt-1 text-lg font-extrabold leading-snug text-ink">{localized(item.title, 'en')}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="primary"
                          className="flex min-h-[44px] w-full items-center justify-center text-xs font-bold"
                          disabled={busy}
                          onClick={() => loadLesson(item.slug, 'story')}
                        >
                          📖 {copy.read}
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex min-h-[44px] w-full items-center justify-center text-xs font-bold"
                          disabled={busy}
                          onClick={() => loadLesson(item.slug, 'quiz')}
                        >
                          🧩 {copy.quiz}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card id="published-lesson-story" className={`surface-card story-reading-card glass-panel glow-border scroll-mt-6 space-y-5 rounded-2xl border border-gold/30 p-4 shadow-md sm:p-6 ${lesson || lessonLoadingSlug ? 'lesson-reader-overlay-open' : ''}`}>
                {lesson || lessonLoadingSlug ? (
                  <header className="lesson-reader-header">
                    <Button type="button" variant="secondary" className="reader-back-button" disabled={Boolean(lessonLoadingSlug)} onClick={() => setLesson(null)} aria-label={copy.closeLesson} title={copy.closeLesson}>
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5m7 7-7-7 7-7" />
                      </svg>
                    </Button>
                    <p className="min-w-0 truncate font-bold text-ink">
                      {lesson ? localized(lesson.title, 'en') : localized(lessons.find((item) => item.slug === lessonLoadingSlug)?.title || '', 'en')}
                      {lesson && storyAward?.lessonId === lesson.id && storyAward.earnedPoints > 0 ? (
                        <span className="points-pop ml-2 inline-flex items-center rounded-full bg-sapphire/10 px-2 py-1 text-xs font-extrabold text-sapphire">
                          +{storyAward.earnedPoints} ⭐ {copy.storyPoints}
                        </span>
                      ) : null}
                    </p>
                  </header>
                ) : null}
                {!lesson ? (
                  <p role={lessonLoadingSlug ? 'status' : undefined}>
                    {lessonLoadingSlug ? copy.loadingLesson : copy.chooseLesson}
                  </p>
                ) : (
                  <div className="lesson-reader-layout">
                    <div className="lesson-story-heading rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/10 via-paper to-sapphire/10 p-4 sm:p-5">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-gold-soft">
                        📖 {lang === 'bn' ? 'নির্বাচিত গল্প ও কুইজ' : 'Selected Story & Quiz'}
                      </p>
                      <h2 className="mt-1 break-words text-xl font-extrabold leading-snug text-ink sm:text-3xl">{localized(lesson.title, 'en')}</h2>
                    </div>
                    <div className="lesson-story-player">
                      <AudioDramaPlayer
                        title={localized(lesson.title, 'en')}
                        slug={lesson.slug}
                        content={localized(lesson.body, 'en')}
                        practiceContent={localized(lesson.body, 'en')}
                        audioUrl={lesson.media?.type === 'audio' ? lesson.media.url : ''}
                        vocabulary={lesson.vocabulary || []}
                        lang={lang}
                      />
                    </div>
                    {!lesson.isOffline ? (
                      <div className="lesson-story-actions flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-12 w-full sm:w-auto"
                          disabled={storyCompletionBusy || storyAward?.lessonId === lesson.id}
                          onClick={markPublishedLessonComplete}
                        >
                          {storyCompletionBusy
                            ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে…' : 'Saving…')
                            : storyAward?.lessonId === lesson.id
                              ? `✓ ${copy.storyCompleted}`
                              : copy.completeStory}
                        </Button>
                        {storyAward?.lessonId === lesson.id && storyAward.earnedPoints > 0 ? (
                          <span className="text-sm font-bold text-sapphire">+{storyAward.earnedPoints} ⭐</span>
                        ) : null}
                        {storyAward?.lessonId === lesson.id && storyAward.earnedPoints === 0 ? (
                          <span role="status" className="text-sm text-ink/70">{copy.storyPointsAlreadyEarned}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {lesson.quiz?.length ? (
                      <div id="published-lesson-quiz" className="lesson-quiz-panel scroll-mt-6 space-y-4">
                        <h3 className="text-xl font-semibold text-ink">{copy.quiz}</h3>
                        {lesson.quiz.map((question, index) => (
                          <fieldset key={`${lesson.id}-${index}`} className="space-y-3 rounded-2xl border border-sapphire/20 bg-paper/70 p-4 sm:p-5">
                            <legend className="text-base font-bold leading-relaxed text-ink sm:text-lg">{localized(question.question, 'en')}</legend>
                            <div className="mt-3 grid gap-2">
                              {question.options.map((option, optionIndex) => (
                              <label key={optionIndex} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed transition ${answers[index] === optionIndex ? 'border-sapphire bg-sapphire/15 ring-1 ring-sapphire/40' : 'border-sapphire/15 bg-paper hover:border-gold/50 hover:bg-gold/5'}`}>
                                <input type="radio" className="mt-1 accent-sapphire" name={`question-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers((previous) => {
                                  const next = [...previous];
                                  next[index] = optionIndex;
                                  return next;
                                })} />
                                <span>{localized(option, 'en')}</span>
                              </label>
                            ))}
                            </div>
                          </fieldset>
                        ))}
                        <Button disabled={busy || !lesson.quiz.every((_, index) => Number.isInteger(answers[index]))} onClick={submitQuiz}>{copy.submit}</Button>
                        {quizResult ? (
                          <p role="status">
                            {quizResult.score} / {quizResult.total}
                            {quizResult.earnedPoints > 0 ? ` · +${quizResult.earnedPoints} ⭐ ${copy.quizPoints}` : ''}
                          </p>
                        ) : null}
                      </div>
                    ) : <p className="lesson-quiz-panel">{copy.noQuiz}</p>}
                  </div>
                )}
              </Card>
            </div>
          ) : !dailyLesson ? <Card><p>{copy.noLessons}</p></Card> : null}
        </section>
      ) : null}

      {tab === 'settings' ? (
        <Card className="surface-card glass-panel glow-border tab-enter space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 pb-3">
            <div>
              <h2 className="section-heading"><span aria-hidden="true">🎯</span> {copy.insights}</h2>
              <p className="mt-1 text-xs opacity-80">
                {lang === 'bn'
                  ? 'আপনার রুটিন ও সম্পন্ন করার ইতিহাসের সমন্বয়ে স্মার্ট মিস-ঝুঁকি পূর্বাভাস ও দিকনির্দেশনা'
                  : 'Smart miss-risk predictions and coaching directions tailored from your routine and completion history'}
              </p>
            </div>
          </div>
          {predictions.length ? (
            <div className="space-y-3">
              {predictions.map((routine) => {
                const riskPct = Math.round(routine.probability * 100);
                const riskTone = riskPct >= 60
                  ? 'border-rose-400/50 bg-rose-500/15 text-rose-300'
                  : riskPct >= 35
                    ? 'border-gold/60 bg-gold/15 text-gold-soft'
                    : 'border-sapphire/50 bg-sapphire/15 text-sapphire';
                return (
                  <div key={routine.id} className="routine-tile space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-ink">{routine.title}</h3>
                        <p className="text-xs opacity-75">{formatNaturalTime(routine.startTime, lang)} – {formatNaturalTime(routine.endTime, lang)}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${riskTone}`}>
                        {copy.risk}: {riskPct}%
                      </span>
                    </div>
                    {routine.direction ? (
                      <p className="rounded-xl border border-gold/25 bg-paper/60 px-3 py-2 text-xs font-medium text-ink/90">
                        💡 {routine.direction}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : <p>{copy.noRoutines}</p>}
        </Card>
      ) : null}

      <section className={tab === 'settings' ? 'space-y-4' : 'hidden'} aria-label={copy.settings}>
          <Card className="surface-card glass-panel glow-border space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                  <h3 className="font-bold text-ink flex items-center gap-2">
                    <span>🕌</span> {lang === 'bn' ? 'নামাজের ওয়াক্ত প্রদর্শন' : 'Show Prayer Times'}
                  </h3>
                  <p className="text-sm text-ink/75 mt-0.5">
                  {lang === 'bn' ? 'নামাজের সময়সূচী ও আজান সেটিংস দেখান বা লুকান' : 'Show or hide prayer times and Azan controls'}
                </p>
              </div>
              <button
                type="button"
                aria-label={lang === 'bn' ? 'নামাজের সময় ও আজান চালু বা বন্ধ করুন' : 'Toggle prayer times and Azan'}
                aria-pressed={showPrayerTimes}
                onClick={() => setShowPrayerTimes(!showPrayerTimes)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${showPrayerTimes ? 'bg-sapphire-deep' : 'bg-ink/20'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${showPrayerTimes ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </Card>
          <PrayerTimesCard lang={lang} />
          <Card className="surface-card glass-panel glow-border space-y-3 p-5">
            <h2 className="text-2xl font-semibold">{copy.settings}</h2>
            <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={saveProfile}>
              <div>
                <div className="flex items-center gap-3">
                  <ProfileAvatar avatarId={profileAvatarId} size="md" />
                  <div>
                    <h3 className="font-semibold">{copy.profile}</h3>
                    <p className="text-sm opacity-75">{user.email}</p>
                  </div>
                </div>
                <label className="mt-2 block">
                  {copy.profileName}
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    maxLength={60}
                    minLength={1}
                    required
                    className="mt-1 block w-full rounded-xl border border-gold/25 bg-paper/70 p-3 text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
                    autoComplete="name"
                  />
                </label>
                <ProfileAvatarPicker value={profileAvatarId} onChange={setProfileAvatarId} lang={lang} />
              </div>
              <Button
                type="submit"
                disabled={busy || (profileName.trim() === user.displayName && profileAvatarId === (user.avatarId || 'sunrise'))}
              >{copy.saveProfile}</Button>
            </form>
          </Card>
          <TelegramSettingsCard
            user={user}
            lang={lang}
            onSaved={(updatedUser) => {
              if (updatedUser) setUser((currentUser) => ({ ...currentUser, ...updatedUser }));
            }}
          />
          <Card className="surface-card glass-panel glow-border space-y-3 p-5">
            <h2 className="text-lg font-semibold">{lang === 'bn' ? 'দ্রুত সেটিংস' : 'Quick settings'}</h2>
            <div className="grid grid-cols-2 gap-2">
              {pwaInstallPrompt ? (
                <Button
                  variant="secondary"
                  className="settings-action-button"
                  aria-label={lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install app'}
                  onClick={async () => {
                    pwaInstallPrompt.prompt();
                    await pwaInstallPrompt.userChoice.catch(() => {});
                    setPwaInstallPrompt(null);
                  }}
                >
                  <span aria-hidden="true">📲</span><span>{lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install app'}</span>
                </Button>
              ) : null}
              <Button
                variant="secondary"
                className="settings-action-button"
                aria-label={theme === 'dark' ? copy.themeLight : copy.themeDark}
                onClick={toggleTheme}
              >
                <span key={theme} className="coin-flip" aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
                <span>{theme === 'dark' ? copy.themeLight : copy.themeDark}</span>
              </Button>
              <Button
                variant="secondary"
                className="settings-action-button"
                aria-label={copy.logout}
                onClick={signOut}
                disabled={busy}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" />
                  <path d="M14 16l4-4-4-4M18 12H9" />
                </svg>
                <span>{copy.logout}</span>
              </Button>
            </div>
          </Card>
      </section>
      {replanRoutine && (
        <AdaptiveReplanModal
          routine={replanRoutine}
          lang={lang}
          onClose={() => setReplanRoutine(null)}
          onCompleted={() => loadRoutines(user)}
        />
      )}
      {voiceModalOpen && (
        <VoiceBriefingModal
          user={user}
          routines={routines}
          lang={lang}
          autoPlay={voiceBriefingAutoPlay}
          onClose={() => {
            setVoiceModalOpen(false);
            setVoiceBriefingAutoPlay(false);
          }}
        />
      )}
      <PointsAwardToast lang={lang} />
      {reflectionModalOpen && (
        <EveningReflectionModal
          lang={lang}
          onClose={() => setReflectionModalOpen(false)}
          onSaved={(result) => {
            announceLearningActivity(result.earnedXP);
            loadRoutines(user).catch(reportError);
            window.dispatchEvent(new CustomEvent('smart-routine:sync', { detail: { userId: user.id } }));
          }}
        />
      )}
      {offlineConsentOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-story-cache-title"
            className="surface-card glass-panel glow-border modal-pop w-full max-w-lg space-y-4 rounded-3xl border border-sapphire/40 p-5 shadow-2xl sm:p-7"
          >
            <div aria-hidden="true" className="text-3xl">📥</div>
            <h2 id="offline-story-cache-title" className="text-xl font-extrabold text-ink sm:text-2xl">
              অফলাইনে পড়ার জন্য গল্প ও শব্দার্থ সংরক্ষণ করবেন?
            </h2>
            <p className="leading-relaxed text-ink/85">
              অনুমতি দিলে নির্বাচিত ইংরেজি গল্প ও শব্দের বাংলা অর্থ এই ডিভাইসে রাখা হবে, যাতে ইন্টারনেট ছাড়াও পড়তে পারেন।
            </p>
            <p className="rounded-xl border border-gold/30 bg-paper/70 p-3 text-sm leading-relaxed text-ink/75">
              এতে ইন্টারনেট ডেটা ও ডিভাইসের জায়গা লাগবে। ব্রাউজার বা ডিভাইসের স্টোরেজ পরিষ্কার করলে সংরক্ষিত পাঠ মুছে যেতে পারে। অনুমতি না দিলে গল্প ও শব্দার্থ সংরক্ষণ করা হবে না।
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                className="min-h-[44px]"
                onClick={() => updateOfflineCacheConsent(false)}
              >
                {offlineCacheAllowed ? 'সংরক্ষণ বন্ধ করে মুছুন' : 'এখন নয়'}
              </Button>
              <Button
                className="min-h-[44px]"
                onClick={() => updateOfflineCacheConsent(true)}
              >
                {offlineCacheAllowed ? 'সংরক্ষণ চালু রাখুন' : 'অনুমতি দিন'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
      {activeRoutineTask ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="active-routine-task-title"
          className="routine-task-fullscreen fixed inset-0 z-[300] flex min-h-[100dvh] flex-col overflow-y-auto bg-paper"
        >
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
            <button
              type="button"
              onClick={() => setActiveRoutineTask(null)}
              aria-label={lang === 'bn' ? 'রুটিনে ফিরে যান' : 'Return to routines'}
              className="secondary-button min-h-11 self-start px-4 py-2 text-sm font-bold"
            >
              ← {lang === 'bn' ? 'ফিরে যান' : 'Back'}
            </button>
            <div className="my-auto space-y-6 py-8 text-center">
              <span aria-hidden="true" className="mx-auto grid size-16 place-items-center rounded-2xl border border-gold/35 bg-gold/15 text-3xl">🎯</span>
              <div className="space-y-2">
                <p className="eyebrow">{lang === 'bn' ? 'এখনকার কাজ' : 'CURRENT TASK'}</p>
                <h2 id="active-routine-task-title" className="text-3xl font-black tracking-tight text-ink sm:text-4xl">
                  {activeRoutineTask.title}
                </h2>
                <p className="text-sm text-ink/70">
                  {formatNaturalTime(activeRoutineTask.startTime, lang)} – {formatNaturalTime(activeRoutineTask.endTime, lang)}
                  {' · '}{activeRoutineTask.category}
                </p>
                {activeRoutineTask.anchorHabit ? (
                  <p className="text-sm text-sapphire">{activeRoutineTask.anchorHabit}</p>
                ) : null}
              </div>
              <p className="mx-auto max-w-xl text-base leading-relaxed text-ink/80">
                {lang === 'bn'
                  ? 'এই কাজটি শেষ হলে সম্পন্ন নির্বাচন করুন। বাদ দিতে চাইলে এড়িয়ে যান—কাজের সময় নেভিগেশন লুকানো থাকবে।'
                  : 'Focus on this task. Mark it complete when you finish, or skip it; navigation stays hidden while you work.'}
              </p>
              {error ? <p role="alert" className="mx-auto max-w-xl rounded-xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</p> : null}
              {notice ? <p role="status" className="mx-auto max-w-xl rounded-xl border border-sapphire/30 bg-sapphire/10 px-4 py-3 text-sm font-semibold text-sapphire">{notice}</p> : null}
              <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="min-h-14 flex-1 text-base font-bold"
                  disabled={busy}
                  onClick={() => { void finishRoutineTask('done'); }}
                >
                  <span aria-hidden="true">✅</span>
                  <span className="ml-2">{copy.done}</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-14 flex-1 text-base font-bold"
                  disabled={busy}
                  onClick={() => { void finishRoutineTask('skipped'); }}
                >
                  <span aria-hidden="true">⏭️</span>
                  <span className="ml-2">{copy.skipped}</span>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {stopwatchFullscreen ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-label={copy.stopwatch}
          className="fixed inset-0 z-[200] flex min-h-[100dvh] flex-col items-center justify-center gap-8 overflow-auto bg-slate-950 px-5 py-8 text-white"
          style={{
            paddingTop: 'max(2rem, env(safe-area-inset-top))',
            paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
          }}
        >
          <h2 className="text-lg font-bold uppercase tracking-[0.24em] text-gold-soft">{copy.stopwatch}</h2>
          <StopwatchReadout as="output" className="whitespace-nowrap font-mono text-[clamp(3rem,18vw,10rem)] font-extrabold tabular-nums leading-none tracking-tight" />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {stopwatchStartedAt === null
              ? <Button type="button" className="min-h-14 min-w-32 text-lg" onClick={() => startStopwatch()}><span aria-hidden="true">▶️</span><span className="ml-2">{copy.startTimer}</span></Button>
              : <Button type="button" className="min-h-14 min-w-32 text-lg" variant="secondary" onClick={() => stopStopwatch()}><span aria-hidden="true">⏸️</span><span className="ml-2">{copy.pauseTimer}</span></Button>}
            <Button type="button" variant="secondary" className="min-h-14" onClick={() => resetStopwatch()}><span aria-hidden="true">↻</span><span className="ml-2">{copy.resetTimer}</span></Button>
            <Button type="button" variant="secondary" className="min-h-14" onClick={closeStopwatchFullscreen}><span aria-hidden="true">⤢</span><span className="ml-2">{copy.collapseStopwatch}</span></Button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
