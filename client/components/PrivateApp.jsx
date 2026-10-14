'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { predictMissProbability, routineFeatures, TRAINING_CONSENT_VERSION, todayInZone } from '@smart-routine/shared';
import { enqueueAndFlush } from '../lib/outboxClient.js';
import { useAppStore } from '../lib/appStore.js';
import { answerWithLocalModel } from '../lib/localAssistant.js';
import { apiRequest } from '../lib/apiClient.js';
import { base64UrlToBytes, bengaliCalendarMonthRange, buildCalendarDays } from '../lib/calendar.js';
import { getRoutineMood } from '../lib/routineMood.js';
import { buildAlarmAnnouncement, getNextRoutineTitle, speakWithVoice, buildMissedAnnouncement } from '../lib/voiceBriefing.js';
import { syncAlarmCreate, syncAlarmDelete, syncAlarmUpdate, reportAlarmFired, fetchServerAlarms, fetchMissedAlarms, acknowledgeAlarm } from '../lib/alarmsSync.js';
import { ensureAlarmPushSubscription } from '../lib/pushClient.js';
import { getFocusRoutines } from '../lib/routineFocus.js';
import { AiBadge } from './ui/AiBadge.jsx';
import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';
import { StatusChip } from './ui/StatusChip.jsx';
import { SyncStatus } from './SyncStatus.jsx';

const TelegramSettingsCard = dynamic(() => import('./TelegramSettingsCard.jsx').then((m) => m.TelegramSettingsCard), { ssr: false });
const HabitCirclesCard = dynamic(() => import('./HabitCirclesCard.jsx').then((m) => m.HabitCirclesCard), { ssr: false });
const PrayerTimesCard = dynamic(() => import('./PrayerTimesCard.jsx').then((m) => m.PrayerTimesCard), { ssr: false });
const GamificationBar = dynamic(() => import('./GamificationBar.jsx').then((m) => m.GamificationBar), { ssr: false });
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
import { ProfileAvatar, ProfileAvatarPicker } from './ProfileAvatar.jsx';
import { TodayProgressCard } from './TodayProgressCard.jsx';
import { StoryReader } from './StoryReader.jsx';
import { PrayerAnchorSelector } from './PrayerAnchorSelector.jsx';
import { AddRoutineBuilderCard } from './AddRoutineBuilderCard.jsx';
import { formatNaturalTime } from '../lib/prayerAnchors.js';

const COPY = {
  en: {
    title: 'Smart Routine', today: "Today's routine", lessons: 'Lessons & quizzes', insights: 'Miss risk insights', dashboard: 'Dashboard', voiceBriefing: 'Voice briefing',
    settings: 'Trust & account', register: 'Create account', login: 'Sign in', email: 'Email', password: 'Password',
    name: 'Display name', locale: 'Language', create: 'Create account', signIn: 'Sign in', switchRegister: 'Need an account?',
    googleSignIn: 'Continue with Google',
    profile: 'Your profile', profileName: 'Name shown in the app', profileAvatar: 'Profile avatar', editProfile: 'View or edit your profile', saveProfile: 'Save profile', profileSaved: 'Your profile was updated.',
    passwordHint: 'Use a 4–6 digit PIN. A password of at least 12 characters also works.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    switchLogin: 'Already have an account?', logout: 'Sign out', loading: 'Loading your private app…', addRoutine: 'Add a routine',
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
    noLessons: 'No published lessons are available yet.', read: 'Open lesson', quiz: 'Take quiz', submit: 'Submit answers',
    risk: 'Estimated miss risk', noModel: 'No validated real-data model is active. The model file currently included is synthetic and is intentionally not used to estimate your personal risk.',
    routineSaved: 'Routine queued for sync.', routineDeleted: 'Routine queued for deletion.',
    completionSaved: 'Routine status saved.', completionPending: 'Routine status is still waiting to sync. The app will retry automatically.',
    completionRejected: 'Routine status was not saved. Refresh your routines and try again.',
    chooseLesson: 'Choose a lesson to view its content and quiz.',
    exportDone: 'Your data export has been downloaded.', accountDeleted: 'Your account was deleted.',
    noQuiz: 'This lesson has no quiz.', useAccount: 'Sign in or create an account to use your private routine.',
    select: 'Select', saveStatus: 'Save status', description: 'Build steady habits with a routine that fits your day.',
    assistant: "AM's Routine Assistant", assistantQuestion: "Ask AM's Routine Assistant", assistantUnavailable: 'I can answer common questions about Smart Routine.',
    languageToggle: 'Switch to Bengali', assistantIntro: 'Ask about the app or your routines. Answers use Gemini, then Groq if needed; your question and routine summaries are sent to the server and may be sent to those providers. Local keyword matching is used only if the AI service is unavailable.',
    assistantNoModel: '',
    localAnswer: 'Answered by local assistant', localOnlyReply: 'I can answer common questions about Smart Routine, but not general questions outside the app.',
    localModel: 'Local model', modelVersion: 'Version', modelAuc: 'Holdout AUC', modelBrier: 'Brier score',
    modelCalibration: 'Calibration slope', modelHoldout: 'Holdout examples', modelUnavailable: 'No validated local model is active. Risk predictions need a validated local model.', modelDemoWarning: 'Local synthetic demo only. These risk percentages are illustrative, not validated, and must not be used as personal predictions.',
    assistantSend: 'Ask assistant', assistantDisclaimer: '⚠️ AM’s Routine Assistant can make mistakes. Double-check important advice.',
    themeDark: 'Switch to dark mode', themeLight: 'Switch to light mode', alarmTitle: 'Alarms & focus timer',
    alarmTime: 'Alarm time', alarmName: 'Alarm name', addAlarm: 'Set alarm', noAlarms: 'No alarms set yet.',
    enableBrowserNotifications: 'Enable browser notifications', browserNotificationsOn: 'Browser notifications are enabled.',
    browserNotificationsOff: 'Browser notifications are off. Tap Enable and allow them in your browser prompt.',
    browserNotificationsBlocked: 'Notifications are blocked in browser settings. Allow them for this site, then try again.',
    browserNotificationsUnsupported: 'This browser does not support notifications.',
    dangerAlertUnavailable: 'Live public danger alerts are not configured.',
    deviceDangerAlertsInfo: 'This app does not monitor Google emergency alerts. For Google crisis and wireless emergency alerts, use your Android phone’s Safety & emergency settings.',
    alarmRinging: 'Your alarm is ringing', stopAlarm: 'Stop alarm', removeAlarm: 'Remove alarm',
    snoozeAlarm: 'Snooze 5 min',
    stopwatch: 'Stopwatch', startTimer: 'Start', pauseTimer: 'Pause', resetTimer: 'Reset',
    voiceAlarmNote: 'When an alarm rings, your Google voice speaks the alarm name and your next routine, and a notification is sent with the same message. Alarms ring while this app is open.', alarmVoiceUnavailable: 'The voice alarm could not play in this browser. The notification was still sent.',
    alarmPushOn: 'Closed-app alerts are on for this device — alarms ring even with the app closed.', alarmPushOff: 'Turn on closed-app alerts so alarms ring even with the app closed.',
    enableClosedAppAlerts: '🔔 Enable closed-app alerts', pushUnavailable: 'Closed-app alerts are unavailable in this browser.',
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
    title: 'স্মার্ট রুটিন', today: 'আজকের রুটিন', lessons: 'পাঠ ও কুইজ', insights: 'রুটিন মিসের ঝুঁকি', dashboard: 'ড্যাশবোর্ড', voiceBriefing: 'ভয়েস ব্রিফিং',
    settings: 'বিশ্বাস ও অ্যাকাউন্ট', register: 'অ্যাকাউন্ট তৈরি', login: 'সাইন ইন', email: 'ইমেইল', password: 'পাসওয়ার্ড',
    name: 'নাম', locale: 'ভাষা', create: 'অ্যাকাউন্ট তৈরি', signIn: 'সাইন ইন', switchRegister: 'অ্যাকাউন্ট নেই?',
    googleSignIn: 'Google দিয়ে চালিয়ে যান',
    profile: 'আপনার প্রোফাইল', profileName: 'অ্যাপে দেখানো নাম', profileAvatar: 'প্রোফাইল অবতার', editProfile: 'প্রোফাইল দেখুন বা সম্পাদনা করুন', saveProfile: 'প্রোফাইল সংরক্ষণ', profileSaved: 'আপনার প্রোফাইল আপডেট হয়েছে।',
    passwordHint: '৪–৬ সংখ্যার PIN দিন। কমপক্ষে ১২ অক্ষরের password-ও ব্যবহার করা যাবে।',
    showPassword: 'পাসওয়ার্ড দেখান',
    hidePassword: 'পাসওয়ার্ড লুকান',
    switchLogin: 'আগে থেকেই অ্যাকাউন্ট আছে?', logout: 'সাইন আউট', loading: 'আপনার ব্যক্তিগত অ্যাপ লোড হচ্ছে…', addRoutine: 'রুটিন যোগ করুন',
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
    noLessons: 'এখনো কোনো প্রকাশিত পাঠ নেই।', read: 'পাঠ খুলুন', quiz: 'কুইজ দিন', submit: 'উত্তর জমা দিন',
    risk: 'মিস হওয়ার আনুমানিক ঝুঁকি', noModel: 'যাচাইকৃত বাস্তব-তথ্যের কোনো মডেল চালু নেই। বর্তমানে থাকা মডেল ফাইলটি কৃত্রিম তথ্যের, তাই আপনার ব্যক্তিগত ঝুঁকি অনুমানে এটি ব্যবহার করা হয় না।',
    routineSaved: 'রুটিনটি সিঙ্কের জন্য রাখা হয়েছে।', routineDeleted: 'রুটিন মোছার অনুরোধ সিঙ্কের জন্য রাখা হয়েছে।',
    completionSaved: 'রুটিনের অবস্থা সংরক্ষিত হয়েছে।', completionPending: 'রুটিনের অবস্থা এখনো সিঙ্ক হয়নি। অ্যাপটি স্বয়ংক্রিয়ভাবে আবার চেষ্টা করবে।',
    completionRejected: 'রুটিনের অবস্থা সংরক্ষিত হয়নি। রুটিন রিফ্রেশ করে আবার চেষ্টা করুন।',
    chooseLesson: 'পাঠ ও কুইজ দেখতে একটি পাঠ বেছে নিন।',
    exportDone: 'আপনার তথ্য ডাউনলোড হয়েছে।', accountDeleted: 'আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে।',
    noQuiz: 'এই পাঠে কোনো কুইজ নেই।', useAccount: 'ব্যক্তিগত রুটিন ব্যবহার করতে সাইন ইন করুন বা অ্যাকাউন্ট তৈরি করুন।',
    select: 'বেছে নিন', saveStatus: 'অবস্থা সংরক্ষণ', description: 'আপনার দিনের সঙ্গে মানানসই রুটিনে অভ্যাস গড়ুন।',
    assistant: "AM's রুটিন সহকারী", assistantQuestion: "AM's রুটিন সহকারীকে জিজ্ঞাসা করুন", assistantUnavailable: 'Smart Routine সম্পর্কে সাধারণ প্রশ্নের উত্তর দিতে পারি।',
    languageToggle: 'ইংরেজিতে পরিবর্তন করুন', assistantIntro: 'অ্যাপ বা রুটিন নিয়ে জিজ্ঞাসা করুন। উত্তর Gemini থেকে, প্রয়োজনে Groq থেকে তৈরি হয়; আপনার প্রশ্ন ও রুটিনের সারাংশ server-এ যায় এবং এই AI provider-গুলোতে পাঠানো হতে পারে। AI পরিষেবা না থাকলেই শুধু স্থানীয় keyword matching ব্যবহার হয়।',
    assistantNoModel: '',
    localAnswer: 'স্থানীয় সহকারীর উত্তর', localOnlyReply: 'Smart Routine সম্পর্কে সাধারণ প্রশ্নের উত্তর দিতে পারি, তবে অ্যাপের বাইরের সব প্রশ্নের নয়।',
    localModel: 'স্থানীয় মডেল', modelVersion: 'সংস্করণ', modelAuc: 'Holdout AUC', modelBrier: 'Brier score',
    modelCalibration: 'Calibration slope', modelHoldout: 'Holdout উদাহরণ', modelUnavailable: 'যাচাইকৃত স্থানীয় মডেল চালু নেই। ঝুঁকির অনুমানের জন্য যাচাইকৃত স্থানীয় মডেল প্রয়োজন।', modelDemoWarning: 'শুধু স্থানীয় কৃত্রিম ডেমো। ঝুঁকির শতাংশ যাচাইকৃত নয়; ব্যক্তিগত পূর্বাভাস হিসেবে ব্যবহার করবেন না।',
    assistantSend: 'সহকারীকে জিজ্ঞাসা করুন', assistantDisclaimer: '⚠️ AM’s রুটিন সহকারী ভুল করতে পারে। গুরুত্বপূর্ণ পরামর্শ যাচাই করে নিন।',
    themeDark: 'ডার্ক মোড চালু করুন', themeLight: 'লাইট মোড চালু করুন', alarmTitle: 'অ্যালার্ম ও ফোকাস টাইমার',
    alarmTime: 'অ্যালার্মের সময়', alarmName: 'অ্যালার্মের নাম', addAlarm: 'অ্যালার্ম সেট করুন', noAlarms: 'এখনো কোনো অ্যালার্ম সেট করা নেই।',
    enableBrowserNotifications: 'ব্রাউজার নোটিফিকেশন চালু করুন', browserNotificationsOn: 'ব্রাউজার নোটিফিকেশন চালু আছে।',
    browserNotificationsOff: 'ব্রাউজার নোটিফিকেশন বন্ধ। চালু করুন চাপুন এবং ব্রাউজারের অনুমতি দিন।',
    browserNotificationsBlocked: 'ব্রাউজার সেটিংসে নোটিফিকেশন বন্ধ আছে। এই সাইটের জন্য চালু করে আবার চেষ্টা করুন।',
    browserNotificationsUnsupported: 'এই ব্রাউজারে নোটিফিকেশন সমর্থিত নয়।',
    dangerAlertUnavailable: 'লাইভ জরুরি সতর্কতার উৎস এখনো সেট করা নেই।',
    deviceDangerAlertsInfo: 'এই অ্যাপ Google-এর জরুরি সতর্কতা পর্যবেক্ষণ করে না। Google-এর crisis ও wireless emergency alert-এর জন্য Android ফোনের Safety & emergency সেটিংস ব্যবহার করুন।',
    alarmRinging: 'অ্যালার্ম বাজছে', stopAlarm: 'অ্যালার্ম বন্ধ করুন', removeAlarm: 'অ্যালার্ম সরান',
    snoozeAlarm: '৫ মিনিট স্নুজ',
    stopwatch: 'স্টপওয়াচ', startTimer: 'শুরু', pauseTimer: 'থামান', resetTimer: 'রিসেট',
    voiceAlarmNote: 'অ্যালার্ম বাজলে Google ভয়েসে অ্যালার্মের নাম ও পরের রুটিন শোনা যাবে, আর একই বার্তায় নোটিফিকেশন আসবে। অ্যাপ খোলা থাকলে অ্যালার্ম বাজবে।', alarmVoiceUnavailable: 'এই browser-এ ভয়েস অ্যালার্ম চালানো যায়নি। নোটিফিকেশন পাঠানো হয়েছে।',
    alarmPushOn: 'এই ডিভাইসে বন্ধ-অ্যাপ অ্যালার্ট চালু আছে — অ্যাপ বন্ধ থাকলেও অ্যালার্ম বাজবে।', alarmPushOff: 'বন্ধ-অ্যাপ অ্যালার্ট চালু করুন, তাহলে অ্যাপ বন্ধ থাকলেও অ্যালার্ম বাজবে।',
    enableClosedAppAlerts: '🔔 বন্ধ-অ্যাপ অ্যালার্ট চালু করুন', pushUnavailable: 'এই browser-এ বন্ধ-অ্যাপ অ্যালার্ট সমর্থিত নয়।',
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
          className="block w-full rounded border bg-paper p-3 pr-12 text-ink"
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
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const csrfBody = await csrfResponse.json().catch(() => ({}));
    if (!csrfResponse.ok || typeof csrfBody.csrfToken !== 'string') {
      throw new Error('Could not establish a security token for this request.');
    }
    headers['X-CSRF-Token'] = csrfBody.csrfToken;
  }
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
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
    const error = new Error(`Request failed with status ${response.status}.`);
    error.status = response.status;
    error.body = payload;
    throw error;
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

function GoogleSignInButton({ clientId, lang, disabled, onCredential }) {
  const buttonRef = useRef(null);
  const wrapperRef = useRef(null);
  const credentialHandler = useRef(onCredential);
  const lastRenderKeyRef = useRef('');
  credentialHandler.current = onCredential;

  const renderGoogleButton = useCallback(() => {
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
  }, [clientId, lang]);

  useEffect(() => {
    lastRenderKeyRef.current = '';
    renderGoogleButton();
  }, [renderGoogleButton]);

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
  const [dailyLesson, setDailyLesson] = useState(null);
  const [dailyQuiz, setDailyQuiz] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [model, setModel] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordAction, setPasswordAction] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  const [reminderTime, setReminderTime] = useState(0);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantAnswerSource, setAssistantAnswerSource] = useState('');
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const showPrayerTimes = useAppStore((state) => state.showPrayerTimes);
  const setShowPrayerTimes = useAppStore((state) => state.setShowPrayerTimes);
  const alarms = useAppStore((state) => state.alarms);
  const addAlarm = useAppStore((state) => state.addAlarm);
  const removeAlarm = useAppStore((state) => state.removeAlarm);
  const snoozeAlarm = useAppStore((state) => state.snoozeAlarm);
  const stopwatchElapsedMs = useAppStore((state) => state.stopwatchElapsedMs);
  const stopwatchStartedAt = useAppStore((state) => state.stopwatchStartedAt);
  const startStopwatch = useAppStore((state) => state.startStopwatch);
  const stopStopwatch = useAppStore((state) => state.stopStopwatch);
  const resetStopwatch = useAppStore((state) => state.resetStopwatch);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [alarmName, setAlarmName] = useState('');
  const [alarmTime, setAlarmTime] = useState('');
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState('default');
  const [firingAlarm, setFiringAlarm] = useState(null);
  const [missedAlarms, setMissedAlarms] = useState([]);
  const [pushAlarmReady, setPushAlarmReady] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);
  const [reflectionModalOpen, setReflectionModalOpen] = useState(false);

  const [replanRoutine, setReplanRoutine] = useState(null);
  const alarmSpeechRef = useRef(null);
  const alarmSpeechTimer = useRef(null);
  const firingAlarmRef = useRef(null);
  const catchupSpokenRef = useRef(false);
  const snoozeLinkHandledRef = useRef(false);
  const copy = COPY[lang];

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
      setUser(result.user);
      setProfileName(result.user.displayName);
      setProfileAvatarId(result.user.avatarId || 'sunrise');
      setNotice(copy.profileSaved);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  const loadRoutines = useCallback(async (activeUser = user) => {
    if (!activeUser) return;
    const result = await request(`/api/routines?date=${encodeURIComponent(todayInZone(activeUser.timezone))}`);
    setRoutines(result.routines);
  }, [user]);

  const loadLessons = useCallback(async () => {
    const [publishedResult, dailyResult] = await Promise.allSettled([
      request('/api/lessons'),
      request(`/api/lessons/today?locale=${encodeURIComponent(lang)}`),
    ]);
    if (publishedResult.status === 'fulfilled') {
      setLessons(publishedResult.value.lessons);
    } else {
      reportError(publishedResult.reason);
    }
    if (dailyResult.status === 'fulfilled') {
      setDailyLesson(dailyResult.value.dailyLesson || null);
      setDailyQuiz(dailyResult.value.quiz || null);
    } else {
      setDailyLesson(null);
      setDailyQuiz(null);
      reportError(dailyResult.reason);
    }
  }, [lang, reportError]);

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
      .then(({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        setProfileName(currentUser.displayName);
        setProfileAvatarId(currentUser.avatarId || 'sunrise');
        if (!useAppStore.getState().language) {
          setStoredLanguage(currentUser.locale === 'en' ? 'en' : 'bn');
        }
      })
      .catch((err) => {
        if (active && err.status !== 401 && err.status !== 500 && err.status !== 503) reportErrorRef.current(err);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => { active = false; };
  }, [setStoredLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const handleBeforeInstall = (e) => {
      setPwaInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

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

  const predictions = useMemo(() => {
    if (!model || !user) return [];
    const weekday = new Date(`${todayInZone(user.timezone)}T00:00:00.000Z`).getUTCDay();
    return routines.map((routine) => ({
      ...routine,
      probability: predictMissProbability(model, routineFeatures(routine, weekday)),
    })).sort((a, b) => b.probability - a.probability);
  }, [model, routines, user]);
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
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const due = useAppStore.getState().alarms.filter((alarm) => !alarm.firedAt && alarm.at <= now);
      if (!due.length) return;
      const store = useAppStore.getState();
      due.forEach((alarm) => store.markAlarmFired(alarm.id));
      const firing = due[0];
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
          alarmSpeechRef.current = speakWithVoice(announcement.text, {
            lang: lang === 'bn' ? 'bn-BD' : 'en-US',
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
          new Notification(copy.alarmRinging, { body: announcement.text, tag: `smart-routine-alarm-${firing.id}` });
        } catch (err) {
          reportError(err);
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lang, routines, user, copy.alarmRinging, copy.alarmVoiceUnavailable, reportError]);

  useEffect(() => () => {
    alarmSpeechRef.current?.stop();
    alarmSpeechRef.current = null;
    if (alarmSpeechTimer.current) window.clearInterval(alarmSpeechTimer.current);
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
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        reportError(err);
      }
    }
    const created = { id: crypto.randomUUID(), at, label: alarmName.trim(), firedAt: null };
    addAlarm(created);
    setAlarmName('');
    setAlarmTime('');
    setNotice(copy.addAlarm);
    setError('');
    // Mirror to the server (logged in only) so push/Telegram reach a closed app.
    if (user && 'Notification' in window && Notification.permission === 'granted') {
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
      if (!user) throw new Error(copy.useAccount);
      if (!('Notification' in window)) throw new Error(copy.browserNotificationsUnsupported);
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      setBrowserNotificationPermission(permission);
      if (permission !== 'granted') {
        throw new Error(lang === 'bn' ? '❌ ব্যর্থ হয়েছে! ব্রাউজার সেটিংস থেকে Notification Allow (অনুমতি) দিন।' : '❌ Failed! Please allow notifications in browser settings.');
      }
      try {
        await ensureAlarmPushSubscription();
      } catch {}
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
      const msg = messageFrom(err, lang);
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
    alarmSpeechRef.current?.stop();
    alarmSpeechRef.current = null;
    if (alarmSpeechTimer.current) window.clearInterval(alarmSpeechTimer.current);
    alarmSpeechTimer.current = null;
    firingAlarmRef.current = null;
    setFiringAlarm(null);
  }

  function snoozeOneAlarm(id) {
    const at = Date.now() + 5 * 60 * 1000;
    snoozeAlarm(id, at);
    void syncAlarmUpdate(user, id, { at });
    setNotice(copy.alarmSnoozed);
    setError('');
  }

  function deleteAlarm(id) {
    removeAlarm(id);
    setMissedAlarms((rows) => rows.filter((alarm) => alarm.id !== id));
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
      setUser(result.user);
      setProfileName(result.user.displayName);
      setProfileAvatarId(result.user.avatarId || 'sunrise');
      if (registering) setStoredLanguage(String(form.get('locale') || 'bn'));
      else if (!useAppStore.getState().language) setStoredLanguage(result.user.locale === 'en' ? 'en' : 'bn');
      setNotice(registering ? COPY[result.user.locale === 'en' ? 'en' : 'bn'].create : COPY[result.user.locale === 'en' ? 'en' : 'bn'].signIn);
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
      setUser(result.user);
      setProfileName(result.user.displayName);
      setProfileAvatarId(result.user.avatarId || 'sunrise');
      if (!useAppStore.getState().language) setStoredLanguage(result.user.locale === 'en' ? 'en' : 'bn');
      setNotice(COPY[result.user.locale === 'en' ? 'en' : 'bn'].signIn);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await request('/api/auth/logout', { method: 'POST', body: {} });
      setUser(null);
      setRoutines([]);
      setLessons([]);
      setDailyLesson(null);
      setDailyQuiz(null);
      setLesson(null);
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
    const routine = {
      title: String(form.get('title') || '').trim(),
      startTime: String(form.get('startTime') || ''),
      endTime: String(form.get('endTime') || ''),
      category: String(form.get('category') || 'general'),
      priority: String(form.get('priority') || 'medium'),
      note: '',
      anchorHabit: String(form.get('anchorHabit') || '').trim(),
      isFrog: form.get('isFrog') === 'on',
      clientId: crypto.randomUUID(),
    };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await enqueueAndFlush(user.id, { type: 'routine.create', data: routine });
      await loadRoutines(user);
      setNotice(lang === 'bn' ? `✅ সফলভাবে যোগ হয়েছে: "${routine.title}"` : `✅ Successfully added routine: "${routine.title}"`);
      if (typeof onResetBuilder === 'function') onResetBuilder();
      else formElement?.reset?.();
      setRoutineStartTime('');
      setRoutineEndTime('');
      setAnchorHabitInput('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function askRoutineAssistant(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setAssistantAnswer('');
    setAssistantAnswerSource('');
    try {
      const routinesForContext = predictions.map((p) => ({
        title: p.title, startTime: p.startTime, endTime: p.endTime,
        completionStatus: p.completionStatus, probability: p.probability, isFrog: p.isFrog,
      }));
      const result = await apiRequest('/api/assistant/ask', {
        method: 'POST',
        body: { question: assistantQuestion, lang, routines: routinesForContext },
      });
      setAssistantAnswer(result.answer);
      setAssistantAnswerSource('ai');
    } catch {
      // Offline, or the AI provider is unavailable: fall back to local keyword matching.
      const localAnswer = answerWithLocalModel(assistantQuestion, predictions, model, lang);
      setAssistantAnswer(localAnswer || copy.localOnlyReply);
      setAssistantAnswerSource(localAnswer ? 'local' : 'notice');
    } finally {
      setBusy(false);
    }
  }

  async function removeRoutine(routineId) {
    setBusy(true);
    setError('');
    try {
      await enqueueAndFlush(user.id, { type: 'routine.delete', routineId });
      await loadRoutines(user);
      setNotice(copy.routineDeleted);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function setRoutineStatus(routineId, status) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await enqueueAndFlush(user.id, {
        type: 'completion.set',
        data: { routineId, date: todayInZone(user.timezone), status },
      });
      await loadRoutines(user);
      if (result.operationStatus === 'failed') setError(copy.completionRejected);
      else if (result.operationStatus === 'pending' || result.retryable || result.busy) setNotice(copy.completionPending);
      else setNotice(copy.completionSaved);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
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
      setUser(result.user);
      setNotice('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function loadLesson(slug) {
    setBusy(true);
    setError('');
    try {
      const result = await request(`/api/lessons/${encodeURIComponent(slug)}`);
      setLesson(result.lesson);
      setAnswers([]);
      setQuizResult(null);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    if (!lesson || answers.length !== lesson.quiz.length) return;
    setBusy(true);
    setError('');
    try {
      setQuizResult(await request(`/api/lessons/${lesson.id}/attempts`, { method: 'POST', body: { answers } }));
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
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
      <main className="app-shell mx-auto my-6 max-w-md space-y-5 rounded-[2rem] p-4 sm:my-10 sm:p-7">
        <header className="app-hero relative overflow-hidden rounded-3xl p-6 sm:p-7">
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="brand-orb shrink-0" aria-hidden="true">✨</div>
              <p className="eyebrow">✦ SMART ROUTINE ✦</p>
            </div>
            <div className="flex items-center gap-2">
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
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </Button>
            </div>
          </div>

          <div className="relative z-10 mt-5 space-y-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.title}</h1>
            <p className="text-sm text-white/85 leading-relaxed">{copy.useAccount}</p>
          </div>
        </header>

        <Card as="form" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" className="surface-card space-y-5 rounded-3xl p-6 sm:p-7" onSubmit={authenticate}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gold/25 bg-paper/60 p-1.5">
            <button
              type="button"
              onClick={() => { setRegistering(false); setError(''); }}
              className={`min-h-[42px] rounded-xl text-sm font-bold transition ${!registering ? 'bg-sapphire text-on-sapphire shadow-md' : 'text-ink/75 hover:text-ink'}`}
            >
              {copy.login}
            </button>
            <button
              type="button"
              onClick={() => { setRegistering(true); setError(''); }}
              className={`min-h-[42px] rounded-xl text-sm font-bold transition ${registering ? 'bg-sapphire text-on-sapphire shadow-md' : 'text-ink/75 hover:text-ink'}`}
            >
              {copy.register}
            </button>
          </div>

          <div className="space-y-4">
            {registering ? (
              <>
                <label className="block text-sm font-semibold">
                  {copy.name}
                  <input name="displayName" required maxLength="60" placeholder={lang === 'bn' ? 'আপনার নাম' : 'Your name'} className="mt-1.5 block w-full rounded-xl border bg-paper p-3 text-ink" />
                </label>
                <label className="block text-sm font-semibold">
                  {copy.locale}
                  <select name="locale" value={lang} onChange={(event) => setStoredLanguage(event.target.value)} className="mt-1.5 block w-full rounded-xl border bg-paper p-3 text-ink">
                    <option value="bn">বাংলা (Bangla)</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </>
            ) : null}

            <label className="block text-sm font-semibold">
              {copy.email}
              <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="mt-1.5 block w-full rounded-xl border bg-paper p-3 text-ink" />
            </label>

            <PasswordField
              label={copy.password}
              copy={copy}
              name="password"
              required
              minLength={registering ? 4 : undefined}
              maxLength="128"
              pattern={registering ? '(?:[0-9]{4,6}|.{12,128})' : undefined}
              inputMode={registering ? 'numeric' : undefined}
              autoComplete={registering ? 'new-password' : 'current-password'}
              hint={registering ? copy.passwordHint : undefined}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-300">
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

          {googleClientId ? (
            <div className="space-y-3 border-t border-gold/20 pt-4">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-ink/60">{copy.googleSignIn}</p>
              <GoogleSignInButton
                clientId={googleClientId}
                lang={lang}
                disabled={busy}
                onCredential={authenticateWithGoogle}
              />
            </div>
          ) : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="app-shell mx-auto my-5 max-w-6xl space-y-5 rounded-[2rem] p-3 sm:my-8 sm:p-7">
      <header className="app-hero relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="relative z-10">
          <p className="eyebrow">✦ MAKE SPACE FOR WHAT MATTERS ✦</p>
          <h1 className="app-title mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">
            {copy.title}<span className="ai-title-mark" aria-label="AI">AI</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm opacity-90 sm:text-base">
            <button
              type="button"
              className="hero-user-pill inline-flex max-w-full items-center gap-2 rounded-full border border-gold/45 px-3 py-1 font-semibold shadow-sm"
              aria-label={copy.editProfile}
              title={copy.editProfile}
              onClick={() => setTab('settings')}
            >
              <ProfileAvatar avatarId={user.avatarId || 'sunrise'} size="sm" />
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M3.5 12h17M12 3c2.3 2.4 3.4 5.4 3.4 9S14.3 18.6 12 21c-2.3-2.4-3.4-5.4-3.4-9S9.7 5.4 12 3Z" />
              </svg>
              <span className="truncate">{user.displayName}</span>
            </button>
            <span className="hero-description">{copy.description}</span>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 font-mono text-sm">
            <span aria-hidden="true">🕰️</span>{new Date(clockNow).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="app-hero-actions relative z-10 flex items-center gap-2">
          {pwaInstallPrompt ? (
            <Button
              variant="primary"
              onClick={async () => {
                pwaInstallPrompt.prompt();
                await pwaInstallPrompt.userChoice.catch(() => {});
                setPwaInstallPrompt(null);
              }}
            >
              <span aria-hidden="true">📲</span>
              <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}</span>
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setVoiceModalOpen(true)}>
            <span aria-hidden="true">🎧</span><span>{copy.voiceBriefing}</span>
          </Button>
          <Button
            variant="secondary"
            className="language-toggle-button"
            aria-label={copy.languageToggle}
            title={copy.languageToggle}
            onClick={() => setStoredLanguage(lang === 'bn' ? 'en' : 'bn')}
          ><span className="language-toggle-globe" aria-hidden="true">🌐</span><LanguageFlag lang={lang === 'bn' ? 'en' : 'bn'} /><span>{lang === 'bn' ? 'English' : 'বাংলা'}</span></Button>
          <Button
            variant="secondary"
            className="icon-button"
            aria-label={theme === 'dark' ? copy.themeLight : copy.themeDark}
            title={theme === 'dark' ? copy.themeLight : copy.themeDark}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >{theme === 'dark' ? '☀️' : '🌙'}</Button>
          <Button variant="secondary" className="account-logout" onClick={signOut} disabled={busy}><span aria-hidden="true">🚪</span><span>{copy.logout}</span></Button>
        </div>
      </header>
      <SyncStatus userId={user.id} lang={lang} />
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-400 bg-rose-500/15 px-4 py-3 text-sm font-bold text-rose-300 shadow-lg">
          <span>{error.startsWith('❌') ? error : `❌ ${error}`}</span>
          <button type="button" onClick={() => setError('')} className="rounded-lg border border-rose-400/50 px-2.5 py-1 text-xs font-extrabold">✕</button>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-sapphire bg-sapphire/15 px-4 py-3 text-sm font-bold text-sapphire shadow-lg">
          <span>{notice.startsWith('✅') ? notice : `✅ ${notice}`}</span>
          <button type="button" onClick={() => setNotice('')} className="rounded-lg border border-sapphire/50 px-2.5 py-1 text-xs font-extrabold">✕</button>
        </div>
      ) : null}
      {(error || notice) ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in fade-in">
          <div className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-xs sm:text-sm font-extrabold shadow-2xl ${
            error ? 'border-rose-400 bg-paper text-rose-300' : 'border-sapphire bg-paper text-sapphire'
          }`}>
            <span>{error ? (error.startsWith('❌') ? error : `❌ ${error}`) : (notice.startsWith('✅') ? notice : `✅ ${notice}`)}</span>
            <button type="button" onClick={() => { setError(''); setNotice(''); }} className="ml-2 rounded border border-current/40 px-2 py-0.5 text-xs">✕</button>
          </div>
        </div>
      ) : null}
      {firingAlarm ? (
        <Card className="alarm-banner flex flex-col gap-4" role="alert">
          <p className="text-xl font-bold sm:text-2xl"><span aria-hidden="true">🔔</span> {copy.alarmRinging}: {firingAlarm.label || copy.alarmTime}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={dismissAlarm} className="min-h-[52px] text-lg"><span aria-hidden="true">⏹️</span><span className="ml-2">{copy.stopAlarm}</span></Button>
            <Button variant="secondary" onClick={snoozeFiringAlarm} className="min-h-[52px] text-lg"><span aria-hidden="true">⏰</span><span className="ml-2">{copy.snoozeAlarm}</span></Button>
          </div>
        </Card>
      ) : null}
      <nav className="app-tabs" aria-label={copy.title}>
        {[
          ['today', '🌤️', copy.today], ['dashboard', '📊', copy.dashboard], ['lessons', '📚', copy.lessons], ...(model ? [['insights', '✨', copy.insights]] : []), ['assistant', 'AI', copy.assistant], ['settings', '🛡️', copy.settings],
        ].map(([key, icon, label]) => (
          <Button key={key} variant={tab === key ? 'primary' : 'secondary'} className={`tab-button ${tab === key ? 'tab-button-active' : ''}`} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
            <span className="tab-icon" aria-hidden="true">{key === 'assistant' ? <AiBadge lang={lang} /> : icon}</span><span>{label}</span>
          </Button>
        ))}
      </nav>

      <div className={tab === 'today' ? 'block' : 'hidden'}>
        <PrayerTimesCard lang={lang} />
      </div>

      {tab === 'dashboard' ? (
        <section className="space-y-4">
          <GamificationBar lang={lang} />
          <RoutineDashboard lang={lang} userId={user.id} />
          <BadgesShowcase lang={lang} />
          <HeatmapGrid lang={lang} />
          <HabitCirclesCard lang={lang} />
        </section>
      ) : null}

      {tab === 'today' ? (
        <section className="space-y-4">
          <TodayProgressCard
            lang={lang}
            routines={routines}
            onOpenVoiceBriefing={() => setVoiceModalOpen(true)}
            onScrollToAddRoutine={() => {
              const el = document.getElementById('add-routine-card');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* PrayerTimesCard is mounted above tabs so Azan stays active */}

          {reminders.length ? (
            <Card className="border-gold bg-gold-soft" role="status">
              <h2 className="font-bold">{copy.reminder}</h2>
              <ul>{reminders.map((routine) => <li key={routine.id}>{routine.title} · {routine.startTime}</li>)}</ul>
            </Card>
          ) : null}

          {focusRoutines.length ? (
            <Card className="surface-card space-y-2">
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

          <Card className="surface-card space-y-4">
            <h2 className="section-heading"><span aria-hidden="true">🌤️</span> {copy.today}</h2>
            {routines.length === 0 ? <p>{copy.noRoutines}</p> : (
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
                      <button
                        type="button"
                        onClick={() => setReplanRoutine(routine)}
                        title={lang === 'bn' ? 'সময় কম? ৫ মিনিটের সংক্ষেপ বিকল্প' : 'Short on time? 5-min version'}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
                      >
                        <span aria-hidden="true">⚡</span>
                        <span>{lang === 'bn' ? '৫ মিনিট' : '5 min'}</span>
                      </button>
                      <Button
                        className="min-h-[42px] px-3.5 text-xs font-bold sm:text-sm"
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
                          className="icon-button min-h-[40px] min-w-[40px]"
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
                        className="icon-button min-h-[40px] min-w-[40px] text-ink/60 hover:text-red-400"
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

          <AddRoutineBuilderCard
            lang={lang}
            copy={copy}
            busy={busy}
            onSubmitRoutine={addRoutine}
          />

          <details className="surface-card group rounded-2xl p-4 transition">
            <summary className="cursor-pointer font-bold text-ink flex items-center justify-between list-none">
              <span className="flex items-center gap-2">
                <span aria-hidden="true">📅</span>
                <span>{lang === 'bn' ? 'বাংলাদেশ ছুটির দিন ও মাসিক ক্যালেন্ডার' : 'Holiday & Monthly Calendar'}</span>
              </span>
              <span className="text-xs font-semibold text-sapphire group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-4 space-y-4 pt-3 border-t border-sapphire/15">
              <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-heading"><span aria-hidden="true">📅</span> {lang === 'bn' ? copy.holidayCalendar : copy.calendar}</h2>
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
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} aria-hidden="true" className="min-h-16 rounded-lg" />;
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
                      <span>{day.day}</span>{day.bengaliDay ? <span className="text-[10px] opacity-70 sm:text-xs">{day.bengaliDay}</span> : null}
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
          </details>

          <details className="surface-card group rounded-2xl p-4 transition">
            <summary className="cursor-pointer font-bold text-ink flex items-center justify-between list-none">
              <span className="flex items-center gap-2">
                <span aria-hidden="true">💡</span>
                <span>{lang === 'bn' ? 'নতুন রুটিনের ধারণা ও টেমপ্লেট সংগ্রহ' : 'Routine Ideas & Starter Templates'}</span>
              </span>
              <span className="text-xs font-semibold text-sapphire group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-4 space-y-4 pt-3 border-t border-sapphire/15">
              <GoalToRoutine lang={lang} onRoutinesAdded={() => loadRoutines(user).catch(reportError)} />
              <TemplatePicker lang={lang} onRoutineAdded={() => loadRoutines(user).catch(reportError)} />
            </div>
          </details>

          <div id="alarm-section-card" className="scroll-mt-6">
              <section className="grid gap-4 lg:grid-cols-2">
            <Card className="surface-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="section-heading"><span aria-hidden="true">⏱️</span> {copy.stopwatch}</h2>
                <span className="stopwatch-display" role="timer" aria-live="off">
                  {formatStopwatch(stopwatchElapsedMs + (stopwatchStartedAt === null ? 0 : Math.max(0, clockNow - stopwatchStartedAt)))}
                </span>
              </div>
              <p className="opacity-75">{copy.focus}</p>
              <div className="flex flex-wrap gap-2">
                {stopwatchStartedAt === null
                  ? <Button onClick={() => startStopwatch()}><span aria-hidden="true">▶️</span><span className="ml-2">{copy.startTimer}</span></Button>
                  : <Button variant="secondary" onClick={() => stopStopwatch()}><span aria-hidden="true">⏸️</span><span className="ml-2">{copy.pauseTimer}</span></Button>}
                <Button variant="secondary" onClick={() => resetStopwatch()}><span aria-hidden="true">↻</span><span className="ml-2">{copy.resetTimer}</span></Button>
              </div>
            </Card>
            <Card className="surface-card space-y-4">
              <h2 className="section-heading"><span aria-hidden="true">🔔</span> {copy.alarmTitle}</h2>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={scheduleAlarm}>
                <label className="block">{copy.alarmTime}<input type="datetime-local" value={alarmTime} min={localDateTimeValue(new Date(clockNow + 60_000))} onChange={(event) => setAlarmTime(event.target.value)} required className="polished-input mt-1 block w-full p-3" /></label>
                <label className="block">{copy.alarmName}<input value={alarmName} onChange={(event) => setAlarmName(event.target.value)} maxLength={60} placeholder={copy.alarmName} className="polished-input mt-1 block w-full p-3" /></label>
                <div className="sm:col-span-2">
                  <Button type="submit" className="min-h-[52px] w-full text-lg"><span aria-hidden="true">⏰</span><span className="ml-2">{copy.addAlarm}</span></Button>
                </div>
              </form>
              <p className="text-sm opacity-75">{copy.voiceAlarmNote}</p>
              <div className="flex flex-col gap-2">
                {pushAlarmReady || browserNotificationPermission === 'granted' ? (
                  <p role="status" className="text-sm font-semibold text-sapphire">🔔 {pushAlarmReady ? copy.alarmPushOn : copy.browserNotificationsOn}</p>
                ) : (
                  <Button type="button" onClick={enableClosedAppAlerts} className="min-h-[52px] w-full text-lg">
                    {copy.enableClosedAppAlerts}
                  </Button>
                )}
                {!pushAlarmReady && browserNotificationPermission === 'granted' ? (
                  <>
                    <p className="text-sm opacity-75">{copy.alarmPushOff}</p>
                    <Button type="button" variant="secondary" onClick={enableClosedAppAlerts} className="min-h-[48px]">
                      {copy.enableClosedAppAlerts}
                    </Button>
                  </>
                ) : null}
                {browserNotificationPermission === 'denied' ? <p role="alert" className="text-sm text-gold">{copy.browserNotificationsBlocked}</p> : null}
                {browserNotificationPermission === 'unsupported' ? <p role="status" className="text-sm">{copy.browserNotificationsUnsupported}</p> : null}
              </div>
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' ? <p role="status" className="text-sm text-gold">{copy.alarmPermissionDenied}</p> : null}
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
                  <li key={alarm.id} className="alarm-row flex items-center justify-between gap-3 rounded-xl px-3 py-2">
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
          </div>
        </section>
      ) : null}

      {tab === 'lessons' ? (
        <section className="space-y-4">
          {dailyLesson ? <DailyLessonCard dailyLesson={dailyLesson} quiz={dailyQuiz} lang={lang} /> : null}
          {lessons.length ? (
            <div className="space-y-4">
              <Card className="surface-card space-y-3 p-4 sm:p-6">
                <h2 className="text-xl font-extrabold text-gold-soft">{copy.lessons}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {lessons.map((item) => (
                    <div key={item.slug} className="rounded-xl border border-gold/35 bg-paper p-3.5 flex flex-col justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-sapphire">
                          📖 {lang === 'bn' ? 'গল্প ও কুইজ' : 'Story & Quiz'}
                        </p>
                        <h3 className="mt-1 text-base font-bold text-ink">{localized(item.title, lang)}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="primary"
                          className="flex min-h-[42px] w-full items-center justify-center text-xs font-bold"
                          disabled={busy}
                          onClick={() => loadLesson(item.slug)}
                        >
                          📖 {copy.read}
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex min-h-[42px] w-full items-center justify-center text-xs font-bold"
                          disabled={busy}
                          onClick={() => loadLesson(item.slug)}
                        >
                          🧩 {copy.quiz}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="surface-card space-y-4 p-4 sm:p-6">
                {!lesson ? <p>{copy.chooseLesson}</p> : (
                  <>
                    <div className="rounded-xl border-2 border-gold/40 bg-paper p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-gold-soft">
                        📖 {lang === 'bn' ? 'নির্বাচিত গল্প ও কুইজ' : 'Selected Story & Quiz'}
                      </p>
                      <h2 className="mt-1 text-xl font-extrabold text-ink sm:text-2xl">{localized(lesson.title, lang)}</h2>
                    </div>
                    <AudioDramaPlayer
                      title={localized(lesson.title, lang)}
                      content={localized(lesson.body, lang)}
                      vocabulary={lesson.vocabulary || []}
                      lang={lang}
                    />
                    {lesson.quiz?.length ? (
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold">{copy.quiz}</h3>
                        {lesson.quiz.map((question, index) => (
                          <fieldset key={`${lesson.id}-${index}`} className="space-y-2">
                            <legend>{localized(question.question, lang)}</legend>
                            {question.options.map((option, optionIndex) => (
                              <label key={optionIndex} className="block">
                                <input type="radio" name={`question-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers((previous) => {
                                  const next = [...previous];
                                  next[index] = optionIndex;
                                  return next;
                                })} />{' '}{localized(option, lang)}
                              </label>
                            ))}
                          </fieldset>
                        ))}
                        <Button disabled={busy || !lesson.quiz.every((_, index) => Number.isInteger(answers[index]))} onClick={submitQuiz}>{copy.submit}</Button>
                        {quizResult ? <p role="status">{quizResult.score} / {quizResult.total}</p> : null}
                      </div>
                    ) : <p>{copy.noQuiz}</p>}
                  </>
                )}
              </Card>
            </div>
          ) : !dailyLesson ? <Card><p>{copy.noLessons}</p></Card> : null}
        </section>
      ) : null}

      {tab === 'insights' && model ? (
        <Card className="surface-card space-y-4">
          <h2 className="section-heading"><span aria-hidden="true">✨</span> {copy.insights}</h2>
          <div className="grid gap-3 rounded-2xl border border-gold/20 bg-gold/5 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {model.demo ? <p role="note" className="rounded border border-amber-500 bg-amber-50 p-3 text-amber-950 sm:col-span-2 lg:col-span-3">{copy.modelDemoWarning}</p> : null}
            <p><span className="font-semibold">{copy.localModel}:</span> <span dir="ltr">{model.version}</span></p>
            <p><span className="font-semibold">{copy.modelAuc}:</span> {Math.round(model.metrics.auc * 100)}%</p>
            <p><span className="font-semibold">{copy.modelBrier}:</span> {model.metrics.brier.toFixed(3)}</p>
            <p><span className="font-semibold">{copy.modelCalibration}:</span> {model.metrics.calibrationSlope.toFixed(2)}</p>
            <p><span className="font-semibold">{copy.modelHoldout}:</span> {model.metrics.holdoutRows}</p>
          </div>
          {predictions.length ? predictions.map((routine) => (
            <div key={routine.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-sapphire/20 pb-3">
              <div><h3 className="font-semibold">{routine.title}</h3><p>{routine.startTime}–{routine.endTime}</p></div>
              <span><AiBadge lang={lang} /> <span className="ml-2">{model.demo ? (lang === 'bn' ? 'ডেমো ঝুঁকি' : 'Demo risk') : copy.risk}: {Math.round(routine.probability * 100)}%</span></span>
            </div>
          )) : <p>{copy.noRoutines}</p>}
        </Card>
      ) : null}

      {tab === 'assistant' ? (
        <section className="space-y-4">
          <Card className="surface-card space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="section-heading">{copy.assistant}</h2>
              <AiBadge lang={lang} />
            </div>
            <p>{copy.assistantIntro}</p>
            <form className="space-y-3" onSubmit={askRoutineAssistant}>
              <label className="block">
                {copy.assistantQuestion}
                <textarea
                  value={assistantQuestion}
                  onChange={(event) => setAssistantQuestion(event.target.value)}
                  maxLength={2000}
                  required
                  rows={4}
                  className="mt-1 block w-full rounded border bg-paper p-3 text-ink"
                />
              </label>
              <Button type="submit" disabled={busy}><AiBadge lang={lang} /><span className="ml-2">{copy.assistantSend}</span></Button>
              <p className="text-xs opacity-70">{copy.assistantDisclaimer}</p>
            </form>
          </Card>
          {assistantAnswer ? (
            <Card aria-live="polite" className={`surface-card whitespace-pre-wrap ${assistantAnswerSource === 'notice' ? 'border-gold' : ''}`}>
              {assistantAnswerSource === 'local' ? <p className="eyebrow mb-2">{copy.localAnswer}</p> : null}
              {assistantAnswer}
              <p className="mt-3 border-t border-gold/20 pt-2 text-xs opacity-70">{copy.assistantDisclaimer}</p>
            </Card>
          ) : null}
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className="space-y-4">
          <Card className="surface-card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                  <h3 className="font-bold text-ink flex items-center gap-2">
                    <span>🕌</span> {lang === 'bn' ? 'নামাজের ওয়াক্ত প্রদর্শন' : 'Show Prayer Times'}
                  </h3>
                  <p className="text-sm text-ink/75 mt-0.5">
                  {lang === 'bn' ? 'হোমপেজে নামাজের সময়সূচী দেখান বা গোপন রাখুন' : 'Display or hide daily prayer times schedule'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrayerTimes(!showPrayerTimes)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${showPrayerTimes ? 'bg-emerald-600' : 'bg-gray-300'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${showPrayerTimes ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </Card>
          <Card className="space-y-3">
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
                    className="mt-1 block w-full"
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
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={Boolean(user.consents?.modelTraining?.granted)} disabled={busy} onChange={(event) => changeConsent(event.target.checked)} />
              {copy.consent}
            </label>
          </Card>
          <TelegramSettingsCard
            user={user}
            lang={lang}
            onSaved={(updatedUser) => {
              if (updatedUser) setUser((currentUser) => ({ ...currentUser, ...updatedUser }));
            }}
          />
          <Card className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => { setPasswordAction('export'); setActionPassword(''); }}>{copy.export}</Button>
            <Button variant="secondary" onClick={() => { setPasswordAction('delete'); setActionPassword(''); }}>{copy.deleteAccount}</Button>
          </Card>
          {passwordAction ? (
            <Card as="form" className="space-y-3" onSubmit={submitAccountAction}>
              <PasswordField
                label={copy.confirmPassword}
                copy={copy}
                required
                autoComplete="current-password"
                value={actionPassword}
                onChange={(event) => setActionPassword(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>{passwordAction === 'export' ? copy.exportNow : copy.deleteNow}</Button>
                <Button variant="secondary" onClick={() => setPasswordAction('')}>{copy.cancel}</Button>
              </div>
            </Card>
          ) : null}
        </section>
      ) : null}
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
          onClose={() => setVoiceModalOpen(false)}
        />
      )}
      {reflectionModalOpen && (
        <EveningReflectionModal
          lang={lang}
          onClose={() => setReflectionModalOpen(false)}
          onSaved={() => loadRoutines(user)}
        />
      )}
    </main>
  );
}
