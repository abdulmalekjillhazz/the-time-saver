'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useAppStore } from '../lib/appStore.js';
import { AiBadge } from './ui/AiBadge.jsx';
import { AudioDramaPlayer } from './AudioDramaPlayer.jsx';
import { Button } from './ui/Button.jsx';
import { Card } from './ui/Card.jsx';
import { StatusChip } from './ui/StatusChip.jsx';

const NARRATION_STALE_AFTER_MS = 15 * 60 * 1000;

const COPY = {
  en: {
    title: 'Administration', signIn: 'Sign in', loading: 'Checking your account…', noAccess: 'Access Denied: Your account role is \'user\'.',
    bootstrap: 'After you have an account, an administrator can grant a role. For the first owner, run this from the repository root:',
    mfaSetup: 'Quick security setup', mfaSetupHelp: 'Scan this QR code with Google Authenticator or Microsoft Authenticator. Enter the six-digit code shown in the app.',
    mfaStep1: '1. Open your authenticator app and tap + to add an account.',
    mfaStep2: '2. Scan the QR code below. If scanning is unavailable, copy the setup key instead.',
    mfaStep3: '3. Enter the current six-digit code from the app and continue.',
    copySecret: 'Copy setup key', secretCopied: 'Setup key copied.', setupKeyCopyError: 'Could not copy the setup key. Select and copy it manually.',
    qrError: 'Could not create the QR code. Use the setup key below instead.',
    secret: 'Base32 secret', otp: 'Authenticator URI', code: 'Six-digit code', confirm: 'Confirm setup', verify: 'Verify code',
    alreadyVerified: 'Two-factor verification is active for this session.', needVerify: 'Verify with your authenticator app to unlock staff tools.',
    role: 'Role', reload: 'Refresh data', lessons: 'Lessons', lessonsTab: 'All lessons', draftsTab: 'Daily drafts', dailyStoriesTab: 'Daily stories', landingQuizzesTab: 'Landing quizzes', draftsHeading: 'Review AI drafts',
    landingQuizzesHeading: 'Landing page practice quizzes', landingQuizzesHelp: 'Manage the two bilingual quizzes shown on the landing page. Saving publishes the selected slot immediately; answer keys stay on the server.',
    landingQuizSlot: (slot) => `Quiz slot ${slot}`, landingQuizDefault: 'Built-in starter quiz', landingQuizPublished: 'Published quiz',
    landingQuestion: 'Question', landingOption: (index) => `Option ${index}`, landingCorrectOption: 'Correct answer',
    landingExplanation: 'Explanation shown after an answer', saveAndPublishLandingQuiz: 'Save & publish', landingQuizSaved: 'Landing quiz saved and published.',
    dailyStoriesHeading: 'Published daily stories', dailyStoriesHelp: 'Daily stories publish automatically at midnight Bangladesh time. You can edit the story and quiz after publication.',
    noDailyStories: 'No daily stories have been generated yet.',
    noDailyQuiz: 'No quiz is attached to this daily story.',
    dailyTitle: 'Story title', dailyDescription: 'Short description', dailyStory: 'Story dialogue', dailyQuiz: 'Quiz', dailyQuestion: 'Question', takeaway: 'Key takeaway',
    dailyAiContext: 'Optional direction for the new story', dailyAiContextPlaceholder: 'For example: a realistic story about rebuilding focus after a distracted morning.',
    regenerateDailyStory: 'Generate a new story', confirmRegenerateDailyStory: 'This replaces the published story and quiz for this date. Generate a replacement story?',
    generateNarration: 'Create full story audio & save to Cloudinary', narrationReady: 'Saved full story audio', narrationProcessing: 'Narration is generating…',
    dailyStoryGenerated: 'The story and quiz were replaced with a new version.', narrationGenerated: 'The full story audio is saved in Cloudinary.',
    noDrafts: 'No AI drafts are waiting for approval. Use “Generate one draft now” to create a review draft. The public daily story and quiz publish automatically at midnight Bangladesh time.',
    approveDraft: 'Approve & publish', draftCount: (count) => `${count} draft${count === 1 ? '' : 's'} waiting for your review.`,
    audit: 'Audit log', cleanup: 'Clean up unused uploads',
    cleanupResult: (result) => `Marked orphaned: ${result.markedOrphaned}; deleted: ${result.deleted}; failed: ${result.failed}.`,
    createDraft: 'Create lesson draft', slug: 'URL slug', bnTitle: 'Bangla title', enTitle: 'English title',
    bnBody: 'Bangla body', enBody: 'English body', quizQuestionBn: 'Quiz question (Bangla)', quizQuestionEn: 'Quiz question (English)',
    context: 'Optional story context', contextPlaceholder: 'For example: a student preparing for exams while helping at home. Leave blank for a fresh everyday story.',
    editLesson: 'Edit post', saveEdit: 'Save changes', cancelEdit: 'Cancel',
    addQuestion: 'Add quiz question', removeQuestion: 'Remove question', correctOption: 'Correct option',
    options: 'Four answer options', correct: 'Correct answer', create: 'Create draft', status: 'Status', created: 'Created',
    author: 'Author ID', submitReview: 'Submit for review', publish: 'Publish', archive: 'Archive',
    submitSelfOnly: 'Only the author can submit this draft.', secondPerson: 'A different staff member must publish the author’s draft.',
    roleManagement: 'Change user role', userId: 'Target user ID', newRole: 'New role', updateRole: 'Update role',
    auditTitle: 'Audit log', action: 'Action', actor: 'Actor ID', metadata: 'Metadata', timestamp: 'Timestamp',
    more: 'Load older entries', noLessons: 'No lessons found.', noAudit: 'No audit entries found.',
    error: 'Request failed.', success: 'Changes saved.', dismiss: 'Dismiss', ownerOnly: 'Owner only',
    editorOnly: 'Editors and owners', viewerAllowed: 'Available to staff', slugHelp: 'Lowercase letters, digits, and hyphens.',
    option: (n) => `Option ${n}`, noDatabase: 'The API or database is currently unavailable.',
    email: 'Email', password: 'Password', signInSubmit: 'Sign in to admin panel', tabs: 'Admin sections',
    rolesTab: 'User roles', maintenance: 'Maintenance', auditTab: 'Audit log',
    promoteHelp: 'To promote this account to owner, run in your terminal:',
    createLessonButton: 'Create lesson', setupInstructions: 'Enter this base32 secret in Google Authenticator or 1Password, then enter the current six-digit code.',
    generateAiDrafts: 'Generate one draft now', dailyAiDrafts: 'The public daily story and quiz update automatically at midnight Bangladesh time. Generate a separate review draft here when needed; review drafts are not published automatically.',
    aiDraftsCreated: (count) => `Created ${count} bilingual lesson drafts for review.`,
    draftQuiz: 'Story quiz', correctAnswer: 'Correct answer',
    previewStory: 'Preview story audio', closeStoryPreview: 'Close story audio',
    aiDraft: 'AI draft',
    flagRollout: 'Rollout percentage', saveFlag: 'Save feature flag', enabled: 'Enabled', summary: 'Summary', actions: 'Actions',
    accessRestricted: 'This section requires the owner role.',
    media: 'Lesson media', chooseMedia: 'Choose image, video, or audio', uploadMedia: 'Upload media', removeMedia: 'Remove media',
    mediaHelp: 'JPG, PNG, WebP up to 5 MB; MP4/WebM up to 50 MB; MP3/M4A/WAV/AAC/OGG up to 20 MB.',
    uploadError: 'The upload failed. Check the file and Cloudinary configuration, then try again.',
    uploadFormatError: 'Choose a JPG, PNG, WebP, MP4, or WebM file.',
    uploadTooLarge: 'This file exceeds the upload size limit.',
    uploadVerifyError: 'The upload could not be verified or attached to the lesson.',
    uploadComplete: 'Media uploaded and attached to the lesson.',
    broadcastTab: '📢 Broadcast',
    broadcastHeading: 'Broadcast Notification to All Users',
    broadcastHelp: 'Send an instant push notification and in-app announcement to all registered and subscribed users.',
    broadcastTitle: 'Notification Title',
    broadcastTitlePlaceholder: 'e.g. Special Update from Smart Routine',
    broadcastBody: 'Notification Message',
    broadcastBodyPlaceholder: 'e.g. New daily audio drama and speaking practice is now available!',
    broadcastUrl: 'Click Target URL (optional)',
    broadcastSend: '📢 Send to All Users',
    broadcastSending: 'Sending notification to all users...',
    broadcastSuccess: (count, total) => `Push notification successfully sent to ${count} of ${total} subscribed devices!`,
    broadcastHistory: 'Past Broadcasts',
    noBroadcasts: 'No broadcast notifications sent yet.',
    usersTab: '👥 Users & Access',
    usersHeading: 'User Access Control & Management',
    usersHelp: 'View all registered accounts, change roles, restrict access, or delete users.',
    searchUsersPlaceholder: 'Search by email or name...',
    searchUsers: 'Search',
    allUsersCount: (count) => `Total: ${count} user${count === 1 ? '' : 's'}`,
    userDisplayName: 'Name',
    userEmail: 'Email',
    userRole: 'Role',
    userJoined: 'Joined',
    userStatus: 'Status',
    statusActive: 'Active',
    statusRestricted: 'Restricted',
    restrictUser: 'Restrict',
    unrestrictUser: 'Unrestrict',
    deleteUser: 'Delete',
    confirmRestrict: (name) => `Are you sure you want to restrict "${name}"? They will be logged out and blocked from logging in.`,
    confirmUnrestrict: (name) => `Are you sure you want to unrestrict "${name}"?`,
    confirmDeleteUser: (name) => `Are you sure you want to permanently delete user "${name}"? This action cannot be undone.`,
    userUpdated: 'User status updated successfully.',
    userDeleted: 'User account has been deleted.',
    cannotModifySelf: 'You cannot restrict or delete your own account.',
    noUsersFound: 'No users found.',
    languageToggle: 'বাংলা', themeDark: 'Switch to dark mode', themeLight: 'Switch to light mode',
  },
  bn: {
    title: 'অ্যাডমিন প্যানেল', signIn: 'সাইন ইন', loading: 'অ্যাকাউন্ট যাচাই হচ্ছে…', noAccess: 'Access Denied: Your account role is \'user\'.',
    bootstrap: 'অ্যাকাউন্ট তৈরির পর অনুমোদিত অ্যাডমিন role দিতে পারবেন। প্রথম owner করতে repository root থেকে চালান:',
    mfaSetup: 'সহজ নিরাপত্তা সেটআপ', mfaSetupHelp: 'Google Authenticator বা Microsoft Authenticator দিয়ে QR কোডটি স্ক্যান করুন। অ্যাপে দেখানো ৬ সংখ্যার কোডটি লিখুন।',
    mfaStep1: '১. Authenticator app খুলে + চাপুন।',
    mfaStep2: '২. নিচের QR কোডটি স্ক্যান করুন। স্ক্যান না হলে setup key কপি করুন।',
    mfaStep3: '৩. অ্যাপে দেখানো বর্তমান ৬ সংখ্যার কোড লিখে চালিয়ে যান।',
    copySecret: 'Setup key কপি করুন', secretCopied: 'Setup key কপি হয়েছে।', setupKeyCopyError: 'Setup key কপি করা যায়নি। নিচের key নির্বাচন করে কপি করুন।',
    qrError: 'QR code তৈরি করা যায়নি। নিচের setup key ব্যবহার করুন।',
    secret: 'Base32 secret', otp: 'Authenticator URI', code: '৬ সংখ্যার কোড', confirm: 'সেটআপ নিশ্চিত করুন', verify: 'কোড যাচাই করুন',
    alreadyVerified: 'এই session-এ দুই-ধাপ যাচাই সক্রিয় আছে।', needVerify: 'স্টাফ টুল ব্যবহারের আগে authenticator app-এর কোড যাচাই করুন।',
    role: 'ভূমিকা', reload: 'তথ্য রিফ্রেশ', lessons: 'পাঠসমূহ', lessonsTab: 'সব পাঠ', draftsTab: 'দৈনিক খসড়া', dailyStoriesTab: 'দৈনিক গল্প', landingQuizzesTab: 'ল্যান্ডিং কুইজ', draftsHeading: 'AI খসড়া পর্যালোচনা',
    landingQuizzesHeading: 'ল্যান্ডিং পেজের অনুশীলন কুইজ', landingQuizzesHelp: 'ল্যান্ডিং পেজে দেখা দুটি বাংলা-ইংরেজি কুইজ এখানে পরিচালনা করুন। সংরক্ষণ করলেই slot-টি প্রকাশ হবে; সঠিক উত্তর server-এ গোপন থাকে।',
    landingQuizSlot: (slot) => `কুইজ ${slot}`, landingQuizDefault: 'শুরুর নমুনা কুইজ', landingQuizPublished: 'প্রকাশিত কুইজ',
    landingQuestion: 'প্রশ্ন', landingOption: (index) => `উত্তর ${index}`, landingCorrectOption: 'সঠিক উত্তর',
    landingExplanation: 'উত্তরের পর দেখানো ব্যাখ্যা', saveAndPublishLandingQuiz: 'সংরক্ষণ ও প্রকাশ', landingQuizSaved: 'ল্যান্ডিং কুইজ সংরক্ষণ ও প্রকাশ হয়েছে।',
    dailyStoriesHeading: 'প্রকাশিত দৈনিক গল্প', dailyStoriesHelp: 'দৈনিক গল্প বাংলাদেশ সময় রাত ১২টায় স্বয়ংক্রিয়ভাবে প্রকাশ হয়। প্রকাশের পরেও গল্প ও কুইজ সম্পাদনা করতে পারবেন।',
    noDailyStories: 'এখনও কোনো দৈনিক গল্প তৈরি হয়নি।',
    noDailyQuiz: 'এই দৈনিক গল্পের সাথে কোনো কুইজ নেই।',
    dailyTitle: 'গল্পের শিরোনাম', dailyDescription: 'সংক্ষিপ্ত পরিচিতি', dailyStory: 'গল্পের সংলাপ', dailyQuiz: 'কুইজ', dailyQuestion: 'প্রশ্ন', takeaway: 'মূল শিক্ষা',
    dailyAiContext: 'নতুন গল্পের জন্য নির্দেশনা (ঐচ্ছিক)', dailyAiContextPlaceholder: 'যেমন: মনোযোগ নষ্ট হওয়া সকাল থেকে আবার কাজে ফেরার একটি বাস্তবসম্মত গল্প।',
    regenerateDailyStory: 'নতুন গল্প তৈরি করুন', confirmRegenerateDailyStory: 'এতে এই তারিখের প্রকাশিত গল্প ও কুইজ বদলে যাবে। নতুন গল্প তৈরি করবেন?',
    generateNarration: 'পুরো গল্পের অডিও তৈরি করে Cloudinary-তে রাখুন', narrationReady: 'পুরো গল্পের অডিও সংরক্ষিত', narrationProcessing: 'অডিও তৈরি হচ্ছে…',
    dailyStoryGenerated: 'নতুন গল্প ও কুইজ প্রকাশ করা হয়েছে।', narrationGenerated: 'পুরো গল্পের অডিও Cloudinary-তে সংরক্ষণ করা হয়েছে।',
    noDrafts: 'অনুমোদনের জন্য কোনো AI খসড়া নেই। “এখন একটি খসড়া তৈরি করুন” চাপলে পর্যালোচনার খসড়া তৈরি হবে। দৈনিক গল্প ও কুইজ বাংলাদেশ সময় রাত ১২টায় স্বয়ংক্রিয়ভাবে প্রকাশ হয়।',
    approveDraft: 'অনুমোদন ও প্রকাশ', draftCount: (count) => `আপনার পর্যালোচনার জন্য ${count}টি খসড়া আছে।`,
    audit: 'অডিট লগ', cleanup: 'অব্যবহৃত আপলোড পরিষ্কার',
    cleanupResult: (result) => `Orphan চিহ্নিত: ${result.markedOrphaned}; মোছা: ${result.deleted}; ব্যর্থ: ${result.failed}।`,
    createDraft: 'পাঠের খসড়া তৈরি', slug: 'URL slug', bnTitle: 'বাংলা শিরোনাম', enTitle: 'ইংরেজি শিরোনাম',
    bnBody: 'বাংলা পাঠ্য', enBody: 'ইংরেজি পাঠ্য', quizQuestionBn: 'কুইজ প্রশ্ন (বাংলা)', quizQuestionEn: 'কুইজ প্রশ্ন (ইংরেজি)',
    context: 'নতুন গল্পের প্রেক্ষাপট (ঐচ্ছিক)', contextPlaceholder: 'যেমন: বাড়িতে সাহায্য করার পাশাপাশি পরীক্ষার প্রস্তুতি নিচ্ছে এমন একজন শিক্ষার্থী। খালি রাখলে নতুন দৈনন্দিন গল্প তৈরি হবে।',
    editLesson: 'পোস্ট সম্পাদনা', saveEdit: 'পরিবর্তন সংরক্ষণ', cancelEdit: 'বাতিল',
    addQuestion: 'কুইজ প্রশ্ন যোগ করুন', removeQuestion: 'প্রশ্ন সরান', correctOption: 'সঠিক উত্তর',
    options: 'চারটি উত্তর', correct: 'সঠিক উত্তর', create: 'খসড়া তৈরি', status: 'অবস্থা', created: 'তৈরির সময়',
    author: 'লেখকের ID', submitReview: 'পর্যালোচনায় পাঠান', publish: 'প্রকাশ করুন', archive: 'আর্কাইভ',
    submitSelfOnly: 'শুধু লেখক নিজের খসড়া পর্যালোচনায় পাঠাতে পারেন।', secondPerson: 'লেখকের খসড়া প্রকাশে অন্য স্টাফ সদস্য লাগবে।',
    roleManagement: 'ব্যবহারকারীর ভূমিকা বদলান', userId: 'লক্ষ্য ব্যবহারকারীর ID', newRole: 'নতুন ভূমিকা', updateRole: 'ভূমিকা বদলান',
    auditTitle: 'অডিট লগ', action: 'কাজ', actor: 'Actor ID', metadata: 'বিবরণ', timestamp: 'সময়',
    more: 'পুরোনো তথ্য দেখুন', noLessons: 'কোনো পাঠ নেই।', noAudit: 'কোনো অডিট তথ্য নেই।',
    error: 'অনুরোধ ব্যর্থ হয়েছে।', success: 'পরিবর্তন সংরক্ষিত হয়েছে।', dismiss: 'বন্ধ করুন', ownerOnly: 'শুধু owner',
    editorOnly: 'Editor ও owner', viewerAllowed: 'স্টাফদের জন্য', slugHelp: 'ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন ব্যবহার করুন।',
    option: (n) => `উত্তর ${n}`, noDatabase: 'API অথবা database এখন পাওয়া যাচ্ছে না।',
    email: 'ইমেইল', password: 'পাসওয়ার্ড', signInSubmit: 'অ্যাডমিন প্যানেলে সাইন ইন', tabs: 'অ্যাডমিন বিভাগ',
    rolesTab: 'ব্যবহারকারীর ভূমিকা', maintenance: 'রক্ষণাবেক্ষণ', auditTab: 'অডিট লগ',
    promoteHelp: 'এই অ্যাকাউন্টকে owner করতে টার্মিনালে চালান:',
    createLessonButton: 'পাঠ তৈরি করুন', setupInstructions: 'এই base32 secret Google Authenticator বা 1Password-এ যোগ করে বর্তমান ছয় সংখ্যার কোড দিন।',
    generateAiDrafts: 'এখন একটি খসড়া তৈরি করুন', dailyAiDrafts: 'দৈনিক গল্প ও কুইজ বাংলাদেশ সময় রাত ১২টায় স্বয়ংক্রিয়ভাবে প্রকাশ হয়। এখানে প্রয়োজনে আলাদা পর্যালোচনার খসড়া তৈরি করুন; খসড়া নিজে থেকে প্রকাশ হবে না।',
    aiDraftsCreated: (count) => `পর্যালোচনার জন্য ${count}টি দ্বিভাষিক পাঠের খসড়া তৈরি হয়েছে।`,
    draftQuiz: 'পাঠের কুইজ', correctAnswer: 'সঠিক উত্তর',
    previewStory: 'গল্পের অডিও শুনুন', closeStoryPreview: 'গল্পের অডিও বন্ধ করুন',
    aiDraft: 'AI খসড়া',
    flagRollout: 'রোলআউট শতাংশ', saveFlag: 'ফিচার ফ্ল্যাগ সংরক্ষণ', enabled: 'চালু', summary: 'সারাংশ', actions: 'কাজ',
    accessRestricted: 'এই বিভাগ ব্যবহারে owner ভূমিকা প্রয়োজন।',
    media: 'পাঠের ছবি, ভিডিও বা অডিও', chooseMedia: 'ছবি, ভিডিও বা অডিও বেছে নিন', uploadMedia: 'মিডিয়া আপলোড', removeMedia: 'মিডিয়া সরান',
    mediaHelp: 'JPG, PNG, WebP সর্বোচ্চ ৫ MB; MP4/WebM সর্বোচ্চ ৫০ MB; MP3/M4A/WAV/AAC/OGG সর্বোচ্চ ২০ MB।',
    uploadError: 'আপলোড ব্যর্থ হয়েছে। ফাইল ও Cloudinary সেটিং পরীক্ষা করে আবার চেষ্টা করুন।',
    uploadFormatError: 'JPG, PNG, WebP, MP4 অথবা WebM ফাইল বেছে নিন।',
    uploadTooLarge: 'ফাইলটি আপলোডের নির্ধারিত আকারের চেয়ে বড়।',
    uploadVerifyError: 'আপলোড যাচাই করা যায়নি অথবা পাঠের সাথে যুক্ত করা যায়নি।',
    uploadComplete: 'মিডিয়া আপলোড করে পাঠের সাথে যুক্ত করা হয়েছে।',
    broadcastTab: '📢 ব্রডকাস্ট নোটিফিকেশন',
    broadcastHeading: 'সমস্ত ব্যবহারকারীদের নোটিফিকেশন পাঠান',
    broadcastHelp: 'সমস্ত সাবস্ক্রাইবড ব্যবহারকারীদের ডিভাইসে ইনস্ট্যান্ট পুশ নোটিফিকেশন ও অ্যাপে ঘোষণা পাঠান।',
    broadcastTitle: 'নোটিফিকেশনের শিরোনাম',
    broadcastTitlePlaceholder: 'যেমন: স্মার্ট রুটিনের বিশেষ বার্তা',
    broadcastBody: 'নোটিফিকেশনের বার্তা',
    broadcastBodyPlaceholder: 'যেমন: আজকের নতুন ইংরেজি সংলাপ ও অডিও ড্রামা পাঠ যুক্ত হয়েছে!',
    broadcastUrl: 'ক্লিক করলে যে পেজে যাবে (ঐচ্ছিক)',
    broadcastSend: '📢 সমস্ত ব্যবহারকারীদের পাঠান',
    broadcastSending: 'নোটিফিকেশন পাঠানো হচ্ছে…',
    broadcastSuccess: (count, total) => `সফলভাবে ${total}টি ডিভাইসের মধ্যে ${count}টিতে পুশ নোটিফিকেশন পাঠানো হয়েছে!`,
    broadcastHistory: 'আগের ব্রডকাস্টের তালিকা',
    noBroadcasts: 'এখনও কোনো ব্রডকাস্ট নোটিফিকেশন পাঠানো হয়নি।',
    usersTab: '👥 ব্যবহারকারী নিয়ন্ত্রণ',
    usersHeading: 'ব্যবহারকারী অ্যাক্সেস ও পরিচালনা',
    usersHelp: 'নিবন্ধিত ব্যবহারকারীদের দেখুন, ভূমিকা পরিবর্তন করুন, অ্যাক্সেস সীমাবদ্ধ করুন বা ব্যবহারকারী মুছুন।',
    searchUsersPlaceholder: 'ইমেইল বা নাম দিয়ে খুঁজুন...',
    searchUsers: 'খুঁজুন',
    allUsersCount: (count) => `মোট: ${count} জন ব্যবহারকারী`,
    userDisplayName: 'নাম',
    userEmail: 'ইমেইল',
    userRole: 'ভূমিকা',
    userJoined: 'যোগদান',
    userStatus: 'অবস্থা',
    statusActive: 'সক্রিয়',
    statusRestricted: 'সীমাবদ্ধ',
    restrictUser: 'সীমাবদ্ধ করুন',
    unrestrictUser: 'সক্রিয় করুন',
    deleteUser: 'মুছুন',
    confirmRestrict: (name) => `আপনি কি "${name}" এর অ্যাক্সেস সীমাবদ্ধ করতে চান? তাদের তাৎক্ষণিক লগআউট করা হবে এবং প্রবেশ বন্ধ থাকবে।`,
    confirmUnrestrict: (name) => `আপনি কি "${name}" এর অ্যাকাউন্ট পুনরায় সক্রিয় করতে চান?`,
    confirmDeleteUser: (name) => `আপনি কি নিশ্চিত "${name}" এর অ্যাকাউন্টটি মুছে ফেলতে চান? এই কাজটি আর ফেরানো যাবে না।`,
    userUpdated: 'ব্যবহারকারীর তথ্য সফলভাবে আপডেট হয়েছে।',
    userDeleted: 'ব্যবহারকারীর অ্যাকাউন্ট মুছে ফেলা হয়েছে।',
    cannotModifySelf: 'নিজের অ্যাকাউন্টের সীমাবদ্ধতা বা মোছার কাজ করা যাবে না।',
    noUsersFound: 'কোনো ব্যবহারকারী পাওয়া যায়নি।',
    languageToggle: 'English', themeDark: 'ডার্ক মোড চালু করুন', themeLight: 'লাইট মোড চালু করুন',
  },
};

const ROLES = ['user', 'viewer', 'editor', 'owner'];
const STAFF_ROLES = ['viewer', 'editor', 'owner'];
const FLAG_KEYS = [
  'lessons.daily',
  'lessons.quiz',
  'push.reminders',
  'push.alarms',
  'ml.predictions',
  'gamification.badges',
  'routines.microfallbacks',
  'analytics.heatmap',
  'analytics.insights',
];
const FLAG_LABELS = {
  'lessons.daily': { en: 'Daily AI lessons and quizzes', bn: 'দৈনিক AI পাঠ ও কুইজ' },
  'lessons.quiz': { en: 'Lesson quizzes', bn: 'পাঠের কুইজ' },
  'push.reminders': { en: 'Push reminders', bn: 'পুশ রিমাইন্ডার' },
  'push.alarms': { en: 'Closed-app alarm push', bn: 'বন্ধ-অ্যাপ অ্যালার্ম পুশ' },
  'ml.predictions': { en: 'Routine predictions', bn: 'রুটিনের পূর্বাভাস' },
  'gamification.badges': { en: 'Streaks and badges', bn: 'ধারাবাহিকতা ও ব্যাজ' },
  'routines.microfallbacks': { en: 'Short routine versions', bn: 'রুটিনের সংক্ষিপ্ত সংস্করণ' },
  'analytics.heatmap': { en: 'Completion heatmap', bn: 'সম্পন্ন কাজের হিটম্যাপ' },
  'analytics.insights': { en: 'Completion insights', bn: 'সম্পন্ন কাজের বিশ্লেষণ' },
};

function errorText(error, lang) {
  const message = error?.body?.error?.message ?? error?.error?.message ?? error?.message;
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') return message[lang] || message.en || message.bn || COPY[lang].error;
  return COPY[lang].error;
}

async function api(path, { method = 'GET', body, query } = {}) {
  const url = query ? `${path}?${new URLSearchParams(query)}` : path;
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') {
    const response = await fetch('/api/auth/csrf', { credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.csrfToken !== 'string') {
      const error = new Error('Could not get a security token. Reload the page and try again.');
      error.status = response.status;
      error.body = result;
      throw error;
    }
    headers['X-CSRF-Token'] = result.csrfToken;
  }

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status}).`);
    error.status = response.status;
    error.body = result;
    throw error;
  }
  return result;
}

function Field({ label, ...props }) {
  return (
    <label className="block space-y-1.5 text-xs font-bold text-ink">
      <span>{label}</span>
      <input {...props} className="polished-input block w-full rounded-xl border border-ink/20 bg-paper p-3 text-sm text-ink font-semibold focus:border-gold focus:outline-none" />
    </label>
  );
}

function LocalizedText({ bnLabel, enLabel, name, multiline = false, required = true, value, onChange }) {
  const Input = multiline ? 'textarea' : 'input';
  const className = 'polished-input block w-full rounded-xl border border-ink/20 bg-paper p-3 text-sm text-ink font-semibold focus:border-gold focus:outline-none';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5 text-xs font-bold text-ink">
        <span>{bnLabel}</span>
        <Input name={`${name}-bn`} required={required} value={value?.bn} onChange={onChange ? (event) => onChange('bn', event.target.value) : undefined} className={className} lang="bn" dir="auto" rows={multiline ? 5 : undefined} maxLength={multiline ? 5000 : 200} />
      </label>
      <label className="block space-y-1.5 text-xs font-bold text-ink">
        <span>{enLabel}</span>
        <Input name={`${name}-en`} required={required} value={value?.en} onChange={onChange ? (event) => onChange('en', event.target.value) : undefined} className={className} lang="en" dir="auto" rows={multiline ? 5 : undefined} maxLength={multiline ? 5000 : 200} />
      </label>
    </div>
  );
}

function LessonEditorForm({ lesson, copy, busy, onCancel, onSave }) {
  const [title, setTitle] = useState({ ...lesson.title });
  const [body, setBody] = useState({ ...lesson.body });
  const [quiz, setQuiz] = useState((lesson.quiz || []).map((question) => ({
    ...question,
    question: { ...question.question },
    options: question.options.map((option) => ({ ...option })),
  })));

  return (
    <form
      className="space-y-4 rounded-2xl border border-gold/30 bg-paper/95 p-4 sm:p-5 shadow-md"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ title, body, quiz });
      }}
    >
      <h3 className="text-lg font-bold">{copy.editLesson}: {lesson.slug}</h3>
      <LocalizedText
        bnLabel={copy.bnTitle}
        enLabel={copy.enTitle}
        name="edit-title"
        value={title}
        onChange={(locale, value) => setTitle((current) => ({ ...current, [locale]: value }))}
      />
      <LocalizedText
        bnLabel={copy.bnBody}
        enLabel={copy.enBody}
        name="edit-body"
        multiline
        value={body}
        onChange={(locale, value) => setBody((current) => ({ ...current, [locale]: value }))}
      />
      <div className="space-y-3">
        <h4 className="font-semibold">{copy.draftQuiz}</h4>
        {quiz.map((question, questionIndex) => (
          <fieldset key={questionIndex} className="space-y-3 rounded-lg border border-ink/20 p-3">
            <legend className="px-1 font-medium">{copy.quizQuestionBn} / {copy.quizQuestionEn} {questionIndex + 1}</legend>
            <LocalizedText
              bnLabel={copy.quizQuestionBn}
              enLabel={copy.quizQuestionEn}
              name={`edit-question-${questionIndex}`}
              value={question.question}
              onChange={(locale, value) => setQuiz((current) => current.map((item, index) => index === questionIndex
                ? { ...item, question: { ...item.question, [locale]: value } }
                : item))}
            />
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="space-y-1 text-sm">
                  <span>{copy.option(optionIndex + 1)} · বাংলা</span>
                  <input
                    required
                    maxLength={120}
                    value={option.bn}
                    onChange={(event) => setQuiz((current) => current.map((item, index) => index === questionIndex
                      ? { ...item, options: item.options.map((entry, entryIndex) => entryIndex === optionIndex ? { ...entry, bn: event.target.value } : entry) }
                      : item))}
                    className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink"
                    lang="bn"
                    dir="auto"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>{copy.option(optionIndex + 1)} · English</span>
                  <input
                    required
                    maxLength={120}
                    value={option.en}
                    onChange={(event) => setQuiz((current) => current.map((item, index) => index === questionIndex
                      ? { ...item, options: item.options.map((entry, entryIndex) => entryIndex === optionIndex ? { ...entry, en: event.target.value } : entry) }
                      : item))}
                    className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink"
                    lang="en"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`edit-answer-${questionIndex}`}
                    checked={question.answerIndex === optionIndex}
                    onChange={() => setQuiz((current) => current.map((item, index) => index === questionIndex
                      ? { ...item, answerIndex: optionIndex }
                      : item))}
                  />
                  {copy.correctOption}
                </label>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setQuiz((current) => current.filter((_, index) => index !== questionIndex))}
            >
              {copy.removeQuestion}
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={busy || quiz.length >= 20}
          onClick={() => setQuiz((current) => [...current, {
            question: { bn: '', en: '' },
            options: Array.from({ length: 4 }, () => ({ bn: '', en: '' })),
            answerIndex: 0,
          }])}
        >
          {copy.addQuestion}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{copy.saveEdit}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{copy.cancelEdit}</Button>
      </div>
    </form>
  );
}

function DailyStoryEditorForm({ lesson, copy, busy, onCancel, onSave }) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description);
  const [content, setContent] = useState(lesson.content);
  const [keyTakeaway, setKeyTakeaway] = useState(lesson.keyTakeaway);
  const [questions, setQuestions] = useState((lesson.quiz?.questions || []).map((question) => ({
    ...question,
    options: question.options.map((option) => ({ ...option })),
  })));

  function submit(event) {
    event.preventDefault();
    onSave({
      lesson: {
        slug: lesson.slug,
        title,
        description,
        content,
        category: lesson.category,
        locale: lesson.locale,
        storyType: lesson.storyType,
        keyTakeaway,
        vocabulary: lesson.vocabulary || [],
      },
      quiz: { lessonSlug: lesson.slug, questions },
    });
  }

  return (
    <form className="space-y-4 rounded-2xl border border-gold/30 bg-paper/95 p-4 sm:p-5 shadow-md" onSubmit={submit}>
      <h3 className="font-bold">{copy.editLesson} · {lesson.locale.toUpperCase()} · {lesson.date}</h3>
      <label className="block space-y-1 text-sm font-medium">
        <span>{copy.dailyTitle}</span>
        <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink" />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>{copy.dailyDescription}</span>
        <textarea required maxLength={200} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink" />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>{copy.dailyStory}</span>
        <textarea required minLength={50} rows={12} value={content} onChange={(event) => setContent(event.target.value)} className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink" />
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span>{copy.takeaway}</span>
        <input required maxLength={300} value={keyTakeaway} onChange={(event) => setKeyTakeaway(event.target.value)} className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink" />
      </label>
      <div className="space-y-3">
        <h4 className="font-semibold">{copy.dailyQuiz}</h4>
        {questions.map((question, questionIndex) => (
          <fieldset key={questionIndex} className="space-y-2 rounded-lg border border-ink/20 p-3">
            <legend className="px-1 font-medium">{copy.quizQuestionEn} {questionIndex + 1}</legend>
            <label className="block space-y-1 text-sm">
              <span>{copy.dailyQuestion}</span>
              <input required maxLength={300} value={question.text} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, text: event.target.value } : item))} className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink" />
            </label>
            {question.options.map((option, optionIndex) => (
              <label key={optionIndex} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`daily-answer-${lesson.id}-${questionIndex}`}
                  checked={option.correct}
                  onChange={() => setQuestions((current) => current.map((item, index) => index === questionIndex
                    ? { ...item, options: item.options.map((entry, entryIndex) => ({ ...entry, correct: entryIndex === optionIndex })) }
                    : item))}
                />
                <span className="w-full">
                  <span className="mb-1 block text-xs">{copy.option(optionIndex + 1)}</span>
                  <input required maxLength={200} value={option.text} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex
                    ? { ...item, options: item.options.map((entry, entryIndex) => entryIndex === optionIndex ? { ...entry, text: event.target.value } : entry) }
                    : item))} className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink" />
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{copy.saveEdit}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{copy.cancelEdit}</Button>
      </div>
    </form>
  );
}

export function AdminPanel() {
  const [user, setUser] = useState(null);
  const [adminStatus, setAdminStatus] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [setup, setSetup] = useState(null);
  const [setupQr, setSetupQr] = useState('');
  const [setupQrError, setSetupQrError] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [dailyLessons, setDailyLessons] = useState([]);
  const [landingQuizzes, setLandingQuizzes] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditCursor, setAuditCursor] = useState(null);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [flags, setFlags] = useState({});
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('/today');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState('drafts');
  const [previewDraftSlug, setPreviewDraftSlug] = useState('');
  const [draftContext, setDraftContext] = useState('');
  const [dailyStoryContext, setDailyStoryContext] = useState('');
  const [editingLessonId, setEditingLessonId] = useState('');
  const [editingDailyLessonId, setEditingDailyLessonId] = useState('');
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const storedLanguage = useAppStore((state) => state.language);
  const setStoredLanguage = useAppStore((state) => state.setLanguage);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const lang = storedLanguage === 'en' ? 'en' : 'bn';
  const [uiReady, setUiReady] = useState(false);
  const copy = COPY[lang];

  const showError = useCallback((err) => {
    setError(errorText(err, lang));
    setNotice('');
  }, [lang]);
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  useEffect(() => {
    let active = true;
    useAppStore.persist.rehydrate()
      .then(() => { if (active) setUiReady(true); })
      .catch((err) => {
        if (!active) return;
        showErrorRef.current(err);
        setUiReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (adminStatus?.role && adminStatus.role !== 'owner' && activeTab === 'drafts') {
      setActiveTab('lessons');
    }
  }, [activeTab, adminStatus?.role]);

  useEffect(() => {
    if (!setup?.otpauthUrl) {
      setSetupQr('');
      setSetupQrError(false);
      return undefined;
    }
    let active = true;
    QRCode.toDataURL(setup.otpauthUrl, { width: 220, margin: 2, errorCorrectionLevel: 'M' })
      .then((dataUrl) => {
        if (active) setSetupQr(dataUrl);
      })
      .catch(() => {
        if (active) setSetupQrError(true);
      });
    return () => { active = false; };
  }, [setup?.otpauthUrl]);

  const refreshStatus = useCallback(async () => {
    const [{ user: currentUser }, status] = await Promise.all([
      api('/api/me'),
      api('/api/admin/status'),
    ]);
    setUser(currentUser);
    if (!useAppStore.getState().language) setStoredLanguage(currentUser.locale === 'en' ? 'en' : 'bn');
    setAdminStatus(status);
    return status;
  }, [setStoredLanguage]);

  const loadLessons = useCallback(async () => {
    const result = await api('/api/admin/lessons');
    setLessons(result.lessons);
  }, []);

  const loadDailyLessons = useCallback(async () => {
    const result = await api('/api/admin/daily-lessons');
    setDailyLessons(result.lessons);
  }, []);

  const loadLandingQuizzes = useCallback(async () => {
    const result = await api('/api/admin/landing-quizzes');
    setLandingQuizzes(result.quizzes);
  }, []);

  const loadFlags = useCallback(async () => {
    const result = await api('/api/admin/flags');
    setFlags(result.flags);
  }, []);

  const loadAudit = useCallback(async (before, append = false) => {
    const result = await api('/api/admin/audit-log', { query: { limit: '50', ...(before ? { before } : {}) } });
    setAudit((current) => append ? [...current, ...result.entries] : result.entries);
    setAuditCursor(result.nextCursor);
    setAuditLoaded(true);
  }, []);

  const loadBroadcasts = useCallback(async () => {
    try {
      const result = await api('/api/admin/notifications/broadcast');
      setBroadcasts(result?.announcements || []);
    } catch {
      setBroadcasts([]);
    }
  }, []);

  const loadUsers = useCallback(async (searchQuery = '') => {
    setLoadingUsers(true);
    try {
      const result = await api('/api/admin/users', { query: searchQuery ? { search: searchQuery } : undefined });
      setUsers(result?.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!adminStatus?.mfaVerified || !STAFF_ROLES.includes(adminStatus.role)) return;
    const requests = [loadLessons(), loadDailyLessons(), loadLandingQuizzes(), loadAudit(), loadBroadcasts()];
    if (adminStatus.role === 'owner') requests.push(loadFlags(), loadUsers());
    const results = await Promise.allSettled(requests);
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected) showError(rejected.reason);
  }, [adminStatus, loadAudit, loadBroadcasts, loadDailyLessons, loadFlags, loadLandingQuizzes, loadLessons, loadUsers, showError]);

  useEffect(() => {
    if (!uiReady) return undefined;
    let active = true;
    Promise.all([api('/api/me'), api('/api/admin/status')])
      .then(([profile, status]) => {
        if (!active) return;
        setUser(profile.user);
        if (!useAppStore.getState().language) setStoredLanguage(profile.user.locale === 'en' ? 'en' : 'bn');
        setAdminStatus(status);
        setAuthState('signed-in');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) setAuthState('signed-out');
        else {
          showErrorRef.current(err);
          setAuthState('error');
        }
      });
    return () => { active = false; };
  }, [uiReady, setStoredLanguage]);

  useEffect(() => {
    if (!adminStatus?.mfaVerified || !STAFF_ROLES.includes(adminStatus.role)) return;
    loadAdminData().catch(showError);
  }, [adminStatus, loadAdminData, showError]);

  async function perform(action, successMessage = copy.success) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      setNotice(successMessage);
      return result;
    } catch (err) {
      showError(err);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function beginMfaSetup() {
    const pending = await perform(() => api('/api/admin/mfa/setup'));
    if (!pending) return;
    if (pending?.setup) {
      setSetup(pending.setup);
      return;
    }
    const result = await perform(() => api('/api/admin/mfa/setup', { method: 'POST', body: {} }));
    if (result) setSetup(result);
  }

  async function completeMfa(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') || '');
    const confirmed = await perform(() => api('/api/admin/mfa/confirm', { method: 'POST', body: { code } }), copy.success);
    if (!confirmed) return;
    setSetup(null);
    const status = await perform(refreshStatus);
    if (status) setAdminStatus(status);
  }

  async function verifyMfa(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') || '');
    const verified = await perform(() => api('/api/admin/mfa/verify', { method: 'POST', body: { code } }), copy.success);
    if (!verified) return;
    const status = await perform(refreshStatus);
    if (status) setAdminStatus(status);
  }

  async function createLesson(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const optionValues = [0, 1, 2, 3].map((index) => ({
      bn: String(form.get(`option-${index}-bn`) || ''),
      en: String(form.get(`option-${index}-en`) || ''),
    }));
    const quiz = [];
    const questionBn = String(form.get('quizQuestion-bn') || '').trim();
    const questionEn = String(form.get('quizQuestion-en') || '').trim();
    if (questionBn || questionEn || optionValues.some((option) => option.bn || option.en)) {
      quiz.push({
        question: { bn: questionBn, en: questionEn },
        options: optionValues,
        answerIndex: Number(form.get('answerIndex')),
      });
    }
    const payload = {
      slug: String(form.get('slug') || '').trim(),
      title: {
        bn: String(form.get('title-bn') || '').trim(),
        en: String(form.get('title-en') || '').trim(),
      },
      body: {
        bn: String(form.get('body-bn') || '').trim(),
        en: String(form.get('body-en') || '').trim(),
      },
      vocabulary: [],
      quiz,
      aiDrafted: false,
    };
    const created = await perform(() => api('/api/admin/lessons', { method: 'POST', body: payload }));
    if (!created) return;
    formElement.reset();
    setLessonFormOpen(false);
    await loadAdminData();
  }

  async function saveLandingQuiz(slot, event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const getText = (name) => String(form.get(name) || '').trim();
    const payload = {
      question: {
        bn: getText('question-bn'),
        en: getText('question-en'),
      },
      options: [0, 1, 2, 3].map((index) => ({
        bn: getText(`option-${index}-bn`),
        en: getText(`option-${index}-en`),
      })),
      correctIndex: Number(form.get('correctIndex')),
      explanation: {
        bn: getText('explanation-bn'),
        en: getText('explanation-en'),
      },
    };
    const saved = await perform(
      () => api(`/api/admin/landing-quizzes/${slot}`, { method: 'PUT', body: payload }),
      copy.landingQuizSaved
    );
    if (saved) await loadLandingQuizzes();
  }

  async function generateAiDrafts() {
    const result = await perform(
      () => api('/api/admin/lessons/ai-drafts', { method: 'POST', body: { count: 1, context: draftContext } }),
      copy.aiDraftsCreated(1)
    );
    if (result) {
      setDraftContext('');
      await loadAdminData();
    }
  }

  async function updateLesson(slug, data) {
    const result = await perform(
      () => api(`/api/admin/lessons/${encodeURIComponent(slug)}`, { method: 'PATCH', body: data }),
      copy.success
    );
    if (result) {
      setEditingLessonId('');
      await loadAdminData();
    }
  }

  async function updateDailyLesson(id, data) {
    const result = await perform(
      () => api(`/api/admin/daily-lessons/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
      copy.success
    );
    if (result) {
      setEditingDailyLessonId('');
      await loadAdminData();
    }
  }

  async function regenerateDailyStory(id) {
    if (!globalThis.confirm(copy.confirmRegenerateDailyStory)) return;
    const result = await perform(
      () => api(`/api/admin/daily-lessons/${encodeURIComponent(id)}/regenerate`, {
        method: 'POST',
        body: { context: dailyStoryContext },
      }),
      copy.dailyStoryGenerated
    );
    if (result) {
      setDailyStoryContext('');
      await loadAdminData();
    }
  }

  async function generateDailyNarration(id) {
    const result = await perform(
      () => api(`/api/admin/daily-lessons/${encodeURIComponent(id)}/narration`, { method: 'POST', body: {} }),
      copy.narrationGenerated
    );
    if (result) await loadAdminData();
  }

  async function approveAiDraft(slug) {
    const result = await perform(
      () => api(`/api/admin/lessons/${encodeURIComponent(slug)}/approve`, { method: 'POST', body: {} }),
      copy.success
    );
    if (result) await loadAdminData();
  }

  async function lessonAction(slug, action) {
    const result = await perform(() => api(`/api/admin/lessons/${encodeURIComponent(slug)}/${action}`, { method: 'POST', body: {} }));
    if (result) await loadAdminData();
  }

  async function uploadLessonMedia(slug) {
    const file = mediaFiles[slug];
    if (!file) return;
    const resourceType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
    const cloudinaryType = resourceType === 'audio' ? 'video' : resourceType;
    const allowedTypes = resourceType === 'video'
      ? ['video/mp4', 'video/webm']
      : resourceType === 'audio'
        ? ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a']
        : ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = resourceType === 'video' ? 50 * 1024 * 1024 : resourceType === 'audio' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      setError(copy.uploadFormatError);
      return;
    }
    if (file.size > maxBytes) {
      setError(copy.uploadTooLarge);
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const signed = await api('/api/admin/uploads/signature', {
        method: 'POST',
        body: { resourceType },
      });
      if (
        typeof signed.cloudName !== 'string' || typeof signed.apiKey !== 'string'
        || typeof signed.signature !== 'string' || typeof signed.publicId !== 'string'
        || typeof signed.timestamp !== 'number' || typeof signed.allowedFormats !== 'string'
        || typeof signed.maxBytes !== 'number'
      ) {
        throw new Error(copy.uploadError);
      }
      if (file.size > signed.maxBytes) {
        throw new Error(copy.uploadTooLarge);
      }

      const form = new FormData();
      form.set('file', file);
      form.set('api_key', signed.apiKey);
      form.set('timestamp', String(signed.timestamp));
      form.set('signature', signed.signature);
      form.set('public_id', signed.publicId);
      form.set('allowed_formats', signed.allowedFormats);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/${cloudinaryType}/upload`, {
        method: 'POST',
        body: form,
      });
      const uploaded = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(uploaded?.error?.message || `${copy.uploadError} (${response.status})`);
      }
      if (uploaded?.public_id !== signed.publicId || uploaded?.resource_type !== cloudinaryType) {
        throw new Error(copy.uploadVerifyError);
      }
      const attached = await api(`/api/admin/lessons/${encodeURIComponent(slug)}/media`, {
        method: 'POST',
        body: { publicId: signed.publicId, resourceType },
      });
      if (attached.lesson?.media?.type !== resourceType || !attached.lesson.media.url) {
        throw new Error(copy.uploadVerifyError);
      }
      setMediaFiles((current) => {
        const next = { ...current };
        delete next[slug];
        return next;
      });
      setNotice(copy.uploadComplete);
      try {
        await loadLessons();
      } catch (err) {
        showError(err);
      }
    } catch (err) {
      if (err?.status) showError(err);
      else setError(err?.message || copy.uploadError);
    } finally {
      setBusy(false);
    }
  }

  async function removeLessonMedia(slug) {
    const result = await perform(() => api(`/api/admin/lessons/${encodeURIComponent(slug)}/media`, { method: 'DELETE' }));
    if (result) await loadLessons();
  }

  async function sendBroadcastNotification(event) {
    event.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setSendingBroadcast(true);
    setError('');
    setNotice('');
    try {
      const result = await api('/api/admin/notifications/broadcast', {
        method: 'POST',
        body: {
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          url: broadcastUrl.trim() || '/today',
        },
      });
      setNotice(copy.broadcastSuccess(result.push?.delivered ?? 0, result.push?.totalSubscriptions ?? 0));
      setBroadcastTitle('');
      setBroadcastBody('');
      await loadBroadcasts();
    } catch (err) {
      showError(err);
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function runCleanup() {
    const result = await perform(() => api('/api/admin/uploads/cleanup', { method: 'POST', body: {} }), '');
    if (result) setNotice(copy.cleanupResult(result));
  }

  async function changeRole(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const id = String(form.get('userId') || '').trim();
    const role = String(form.get('role') || '');
    const updated = await perform(() => api(`/api/admin/users/${encodeURIComponent(id)}/role`, {
      method: 'POST',
      body: { role },
    }));
    if (updated) {
      formElement.reset();
      await loadAudit();
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: {
          email: String(form.get('email') || '').trim(),
          password: String(form.get('password') || ''),
        },
      });
      const status = await refreshStatus();
      setAdminStatus(status);
      setAuthState('signed-in');
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveFlag(event, key) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const value = flags[key];
    const result = await perform(() => api(`/api/admin/flags/${encodeURIComponent(key)}`, {
      method: 'POST',
      body: { enabled: value.enabled, rolloutPercent: Number(value.rolloutPercent) },
    }));
    if (result) setFlags((current) => ({ ...current, [key]: result.flag }));
  }

  async function toggleUserRestriction(targetUser) {
    const isRestricting = !targetUser.isRestricted;
    const confirmMsg = isRestricting
      ? copy.confirmRestrict(targetUser.displayName || targetUser.email)
      : copy.confirmUnrestrict(targetUser.displayName || targetUser.email);
    if (!globalThis.confirm(confirmMsg)) return;

    const result = await perform(
      () => api(`/api/admin/users/${targetUser.id}/restrict`, {
        method: 'POST',
        body: { restricted: isRestricting },
      }),
      copy.userUpdated
    );
    if (result) await loadUsers(userSearch);
  }

  async function deleteUserAccount(targetUser) {
    const confirmMsg = copy.confirmDeleteUser(targetUser.displayName || targetUser.email);
    if (!globalThis.confirm(confirmMsg)) return;

    const result = await perform(
      () => api(`/api/admin/users/${targetUser.id}`, { method: 'DELETE' }),
      copy.userDeleted
    );
    if (result) await loadUsers(userSearch);
  }

  async function updateUserRoleDirectly(targetUserId, newRole) {
    const result = await perform(
      () => api(`/api/admin/users/${targetUserId}/role`, {
        method: 'POST',
        body: { role: newRole },
      }),
      copy.userUpdated
    );
    if (result) await loadUsers(userSearch);
  }

  function handleSearchUsers(e) {
    e.preventDefault();
    void loadUsers(userSearch);
  }

  async function refreshAll() {
    setBusy(true);
    setError('');
    try {
      const status = await refreshStatus();
      setAdminStatus(status);
      if (status.mfaVerified) {
        const requests = [loadLessons(), loadDailyLessons(), loadLandingQuizzes(), loadAudit(), loadBroadcasts()];
        if (status.role === 'owner') requests.push(loadFlags(), loadUsers(userSearch));
        await Promise.all(requests);
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  const preferences = (
    <div className="flex gap-2">
      <Button variant="secondary" aria-label={theme === 'dark' ? copy.themeLight : copy.themeDark} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </Button>
      <Button variant="secondary" aria-label={copy.languageToggle} onClick={() => setStoredLanguage(lang === 'bn' ? 'en' : 'bn')}>
        {lang === 'bn' ? '🇺🇸 English' : '🇧🇩 বাংলা'}
      </Button>
    </div>
  );

  if (authState === 'loading') {
    return (
      <main className="app-shell app-shell-main enter-up mx-auto my-6 max-w-4xl space-y-5 rounded-[2rem] p-5 sm:my-10 sm:p-8">
        <header className="flex items-center justify-between gap-3 border-b border-gold/20 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">🛡️</span>
            <h1 className="text-2xl font-black text-ink">{copy.title}</h1>
          </div>
          {uiReady ? preferences : null}
        </header>
        <p role="status" className="py-8 text-center text-sm font-semibold text-ink/70">{copy.loading}</p>
      </main>
    );
  }
  if (authState === 'signed-out') {
    return (
      <main className="app-shell app-shell-main enter-up mx-auto my-6 max-w-md space-y-5 rounded-[2rem] p-5 sm:my-10 sm:p-8">
        <header className="flex items-center justify-between gap-3 border-b border-gold/20 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">🛡️</span>
            <h1 className="text-2xl font-black text-ink">{copy.title}</h1>
          </div>
          {preferences}
        </header>
        {error ? <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-600">{error}</p> : null}
        <Card as="form" className="space-y-4" onSubmit={signIn}>
          <h2 className="text-lg font-black text-ink">{copy.signIn}</h2>
          <Field label={copy.email} name="email" type="email" autoComplete="username" required />
          <Field label={copy.password} name="password" type="password" autoComplete="current-password" required />
          <Button type="submit" disabled={busy} className="primary-button min-h-[44px] w-full text-sm font-bold shadow-md">
            {busy ? copy.loading : copy.signInSubmit}
          </Button>
        </Card>
      </main>
    );
  }
  if (authState === 'error') {
    return (
      <main className="app-shell app-shell-main enter-up mx-auto my-6 max-w-4xl space-y-5 rounded-[2rem] p-5 sm:my-10 sm:p-8">
        <header className="flex items-center justify-between gap-3 border-b border-gold/20 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" aria-hidden="true">🛡️</span>
            <h1 className="text-2xl font-black text-ink">{copy.title}</h1>
          </div>
          {preferences}
        </header>
        <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-center text-sm font-bold text-rose-600">{error || copy.noDatabase}</p>
      </main>
    );
  }

  const isStaff = STAFF_ROLES.includes(adminStatus?.role);
  const isOwner = adminStatus?.role === 'owner';

  return (
    <main lang={lang} className="app-shell app-shell-main enter-up mx-auto my-4 max-w-6xl space-y-6 rounded-[2rem] p-4 sm:my-8 sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gold/20 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-3xl" aria-hidden="true">🛡️</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{copy.title}</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-ink/70">
            {user?.displayName} · <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-black text-gold-soft border border-gold/30">{adminStatus?.role?.toUpperCase()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {adminStatus?.mfaVerified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-600">
              <span>✓</span>
              <span>MFA {lang === 'bn' ? 'সক্রিয়' : 'Verified'}</span>
            </span>
          ) : null}
          {preferences}
        </div>
      </header>

      {error ? (
        <Card role="alert" className="border-rose-500/40 bg-rose-500/10 text-rose-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">{error}</p>
            <Button variant="secondary" onClick={() => setError('')} className="min-h-[36px] text-xs font-bold">{copy.dismiss}</Button>
          </div>
        </Card>
      ) : null}
      {notice ? (
        <Card role="status" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800">
          <p className="text-sm font-bold">{notice}</p>
        </Card>
      ) : null}

      {adminStatus?.role === 'user' ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{copy.noAccess}</h2>
          <p>{copy.promoteHelp}</p>
          <pre className="overflow-x-auto rounded bg-ink p-3 text-paper">node server/scripts/grant-role.js your-email@example.com owner</pre>
          <p>and refresh this page.</p>
        </Card>
      ) : null}

      {isStaff && !adminStatus.mfaEnabled ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">{copy.mfaSetup}</h2>
          {!setup ? (
            <>
              <p>{copy.mfaSetupHelp}</p>
              <Button disabled={busy} onClick={beginMfaSetup}>{copy.mfaSetup}</Button>
            </>
          ) : (
            <>
              <p>{copy.mfaSetupHelp}</p>
              <ol className="list-inside list-decimal space-y-2 text-sm">
                <li>{copy.mfaStep1}</li>
                <li>{copy.mfaStep2}</li>
                <li>{copy.mfaStep3}</li>
              </ol>
              {setupQr ? (
                <img src={setupQr} alt="Authenticator setup QR code" width="220" height="220" className="rounded-lg border bg-white p-2" />
              ) : setupQrError ? <p role="alert">{copy.qrError}</p> : <p role="status">{copy.loading}</p>}
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(setup.secret);
                    setNotice(copy.secretCopied);
                    setError('');
                  } catch {
                    setError(copy.setupKeyCopyError);
                    setNotice('');
                  }
                }}
              >
                {copy.copySecret}
              </Button>
              <Field label={copy.secret} readOnly value={setup.secret} />
              <form className="flex flex-wrap items-end gap-3" onSubmit={completeMfa}>
                <Field label={copy.code} name="code" type="text" required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" placeholder="000000" />
                <Button type="submit" disabled={busy}>{copy.confirm}</Button>
              </form>
            </>
          )}
        </Card>
      ) : null}

      {isStaff && adminStatus.mfaEnabled && !adminStatus.mfaVerified ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">{copy.needVerify}</h2>
          <form className="flex flex-wrap items-end gap-3" onSubmit={verifyMfa}>
            <Field label={copy.code} name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" />
            <Button type="submit" disabled={busy}>{copy.verify}</Button>
          </form>
        </Card>
      ) : null}

      {isStaff && adminStatus.mfaVerified ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-xs sm:text-sm font-bold text-ink/80">{copy.alreadyVerified} · {copy.role}: {adminStatus.role}</p>
            <Button variant="secondary" disabled={busy} onClick={refreshAll} className="min-h-[38px] text-xs font-bold">{copy.reload}</Button>
          </div>

          <nav aria-label={copy.tabs} role="tablist" className="flex flex-wrap gap-2 border-b border-gold/20 pb-3">
            {[
              ...(isOwner ? [['drafts', copy.draftsTab]] : []),
              ['daily-stories', copy.dailyStoriesTab],
              ['landing-quizzes', copy.landingQuizzesTab],
              ['lessons', copy.lessonsTab],
              ['broadcast', copy.broadcastTab],
              ...(isOwner ? [['users', copy.usersTab]] : []),
              ['audit', copy.auditTab],
              ['maintenance', copy.maintenance],
            ].map(([tab, label]) => (
              <button
                key={tab}
                id={`admin-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`admin-panel-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`tab-button min-h-11 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-extrabold transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-sapphire to-sapphire-deep text-on-sapphire shadow-lg shadow-sapphire/25 ring-2 ring-gold/40'
                    : 'border border-gold/25 bg-paper/80 text-ink/75 hover:bg-gold/10 hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {activeTab === 'drafts' && isOwner ? (
            <section id="admin-panel-drafts" role="tabpanel" aria-label={copy.draftsHeading} className="space-y-4">
              <Card className="space-y-3 border-gold/40 bg-paper/95 shadow-lg">
                <h2 className="text-2xl font-semibold">{copy.draftsHeading}</h2>
                <p>{copy.dailyAiDrafts}</p>
                <label className="block space-y-1 text-sm font-medium">
                  <span>{copy.context}</span>
                  <textarea
                    value={draftContext}
                    onChange={(event) => setDraftContext(event.target.value)}
                    maxLength={3000}
                    rows={3}
                    placeholder={copy.contextPlaceholder}
                    className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink"
                  />
                </label>
                <Button disabled={busy} onClick={generateAiDrafts}>
                  <AiBadge lang={lang} /><span className="ml-2">{copy.generateAiDrafts}</span>
                </Button>
              </Card>
              {(() => {
                const drafts = lessons.filter((lesson) => lesson.aiDrafted && ['draft', 'review'].includes(lesson.status));
                return drafts.length ? (
                  <>
                    <p role="status">{copy.draftCount(drafts.length)}</p>
                    <div className="space-y-4">
                      {drafts.map((draft) => (
                        <Card key={draft.id} className="space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <span className="ai-lightmark" role="img" aria-label={copy.aiDraft} title={copy.aiDraft}><span className="ai-lightmark__text">AI</span></span>
                              <p className="mt-2 text-xs text-ink/70">{draft.slug} · {new Date(draft.createdAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en')}</p>
                            </div>
                            <StatusChip lang={lang} status={draft.status} />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <article className="space-y-2 rounded-xl bg-paper p-4">
                              <h3 lang="bn" className="text-lg font-bold" dir="auto">{draft.title?.bn}</h3>
                              <p lang="bn" className="whitespace-pre-wrap leading-relaxed" dir="auto">{draft.body?.bn}</p>
                            </article>
                            <article className="space-y-2 rounded-xl bg-paper p-4">
                              <h3 lang="en" className="text-lg font-bold">{draft.title?.en}</h3>
                              <p lang="en" className="whitespace-pre-wrap leading-relaxed">{draft.body?.en}</p>
                            </article>
                          </div>
                          <div className="space-y-3 rounded-xl border border-sapphire/20 bg-paper p-4">
                            <h3 className="font-semibold">{copy.draftQuiz}</h3>
                            {(draft.quiz || []).map((question, questionIndex) => (
                              <article key={`${draft.id}-quiz-${questionIndex}`} className="space-y-2">
                                <p className="font-medium">
                                  <span lang="bn">{questionIndex + 1}. {question.question?.bn}</span>
                                  <br />
                                  <span lang="en">{question.question?.en}</span>
                                </p>
                                <ol className="list-inside list-decimal space-y-1">
                                  {(question.options || []).map((option, optionIndex) => (
                                    <li key={`${draft.id}-quiz-${questionIndex}-option-${optionIndex}`}>
                                      <span lang="bn">{option.bn}</span>
                                      <span aria-hidden="true"> / </span>
                                      <span lang="en">{option.en}</span>
                                      {optionIndex === question.answerIndex ? <strong> — {copy.correctAnswer}</strong> : null}
                                    </li>
                                  ))}
                                </ol>
                              </article>
                            ))}
                          </div>
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => setPreviewDraftSlug((current) => current === draft.slug ? '' : draft.slug)}
                          >
                            {previewDraftSlug === draft.slug ? copy.closeStoryPreview : copy.previewStory}
                          </Button>
                          {previewDraftSlug === draft.slug ? (
                            <AudioDramaPlayer
                              title={draft.title?.[lang]}
                              content={draft.body?.[lang]}
                              practiceContent={draft.body?.en}
                              lang={lang}
                              onClose={() => setPreviewDraftSlug('')}
                            />
                          ) : null}
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setEditingLessonId((current) => current === draft.id ? '' : draft.id)}
                          >
                            {copy.editLesson}
                          </Button>
                          {editingLessonId === draft.id ? (
                            <LessonEditorForm
                              key={draft.id}
                              lesson={draft}
                              copy={copy}
                              busy={busy}
                              onCancel={() => setEditingLessonId('')}
                              onSave={(data) => updateLesson(draft.slug, data)}
                            />
                          ) : null}
                          <Button disabled={busy} onClick={() => approveAiDraft(draft.slug)}>{copy.approveDraft}</Button>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : <Card role="status">{copy.noDrafts}</Card>;
              })()}
            </section>
          ) : null}

          {activeTab === 'daily-stories' ? (
            <section id="admin-panel-daily-stories" role="tabpanel" aria-label={copy.dailyStoriesHeading} className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">{copy.dailyStoriesHeading}</h2>
                <p className="mt-1 text-sm text-ink/75">{copy.dailyStoriesHelp}</p>
              </div>
              {isOwner ? (
                <Card className="space-y-3 border-sapphire/20 bg-paper">
                  <div>
                    <h3 className="font-semibold text-ink">{copy.regenerateDailyStory}</h3>
                  </div>
                  <label className="block space-y-1 text-sm font-medium">
                    <span>{copy.dailyAiContext}</span>
                    <textarea
                      value={dailyStoryContext}
                      onChange={(event) => setDailyStoryContext(event.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder={copy.dailyAiContextPlaceholder}
                      className="block w-full rounded-md border border-sapphire/30 bg-paper p-3 text-ink focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/20"
                    />
                  </label>
                </Card>
              ) : null}
              {dailyLessons.length ? (
                <div className="space-y-4">
                  {dailyLessons.map((daily) => (
                    <Card key={daily.id} className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-sapphire">{daily.date} · {daily.locale.toUpperCase()}</p>
                          <h3 className="mt-1 text-xl font-bold">{daily.title}</h3>
                          <p className="mt-1 text-sm text-ink/70">{daily.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {isOwner ? (
                            <>
                              <Button disabled={busy} onClick={() => regenerateDailyStory(daily.id)}>
                                <AiBadge lang={lang} /><span className="ml-2">{copy.regenerateDailyStory}</span>
                              </Button>
                              {daily.audio?.status === 'ready' && daily.audio.url ? (
                                <span className="self-center rounded-md border border-sapphire/20 bg-sapphire/5 px-3 py-2 text-sm font-semibold text-sapphire">{copy.narrationReady}</span>
                              ) : (
                                <Button
                                  variant="secondary"
                                  disabled={busy || (
                                    daily.audio?.status === 'processing'
                                    && Date.now() - new Date(daily.audio.updatedAt || 0).getTime() < NARRATION_STALE_AFTER_MS
                                  )}
                                  onClick={() => generateDailyNarration(daily.id)}
                                >
                                  {daily.audio?.status === 'processing'
                                    && Date.now() - new Date(daily.audio.updatedAt || 0).getTime() < NARRATION_STALE_AFTER_MS
                                    ? copy.narrationProcessing
                                    : copy.generateNarration}
                                </Button>
                              )}
                            </>
                          ) : null}
                          {['editor', 'owner'].includes(adminStatus.role) ? (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => setEditingDailyLessonId((current) => current === daily.id ? '' : daily.id)}
                            >
                              {copy.editLesson}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {daily.audio?.status === 'ready' && daily.audio.url ? (
                        <div className="rounded-md border border-sapphire/20 bg-sapphire/5 p-3">
                          <audio controls preload="none" src={daily.audio.url} className="w-full" aria-label={`${copy.narrationReady}: ${daily.title}`} />
                        </div>
                      ) : null}
                      <details>
                        <summary className="cursor-pointer font-semibold">{copy.dailyStory}</summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm leading-relaxed">{daily.content}</p>
                      </details>
                      {daily.quiz?.questions?.length ? (
                        <p className="text-sm text-ink/70">{daily.quiz.questions.length} {copy.dailyQuiz} · {copy.correctAnswer} {daily.quiz.questions.map((question) => question.options.find((option) => option.correct)?.text).filter(Boolean).join(' · ')}</p>
                      ) : <p className="text-sm text-rose-700">{copy.noDailyQuiz}</p>}
                      {editingDailyLessonId === daily.id ? (
                        <DailyStoryEditorForm
                          key={daily.id}
                          lesson={daily}
                          copy={copy}
                          busy={busy}
                          onCancel={() => setEditingDailyLessonId('')}
                          onSave={(data) => updateDailyLesson(daily.id, data)}
                        />
                      ) : null}
                    </Card>
                  ))}
                </div>
              ) : <Card role="status">{copy.noDailyStories}</Card>}
            </section>
          ) : null}

          {activeTab === 'landing-quizzes' ? (
            <section id="admin-panel-landing-quizzes" role="tabpanel" aria-labelledby="admin-tab-landing-quizzes" className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">{copy.landingQuizzesHeading}</h2>
                <p className="mt-1 text-sm text-ink/75">{copy.landingQuizzesHelp}</p>
              </div>
              {['editor', 'owner'].includes(adminStatus.role) ? landingQuizzes.map((quiz) => (
                <Card
                  key={`${quiz.slot}-${quiz.updatedAt || 'default'}`}
                  as="form"
                  className="space-y-4 border-sapphire/20 bg-paper"
                  onSubmit={(event) => saveLandingQuiz(quiz.slot, event)}
                >
                  <div>
                    <h3 className="text-lg font-bold text-ink">{copy.landingQuizSlot(quiz.slot)}</h3>
                    <p className="text-xs text-ink/65">{quiz.isDefault ? copy.landingQuizDefault : copy.landingQuizPublished}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span>{copy.landingQuestion} · বাংলা</span>
                      <textarea name="question-bn" required maxLength={300} rows={2} defaultValue={quiz.question.bn} className="block w-full rounded border border-sapphire/25 bg-paper p-3 text-ink" lang="bn" />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span>{copy.landingQuestion} · English</span>
                      <textarea name="question-en" required maxLength={300} rows={2} defaultValue={quiz.question.en} className="block w-full rounded border border-sapphire/25 bg-paper p-3 text-ink" lang="en" />
                    </label>
                  </div>
                  <div className="space-y-3">
                    {quiz.options.map((option, index) => (
                      <fieldset key={index} className="grid gap-3 rounded-md border border-sapphire/15 p-3 sm:grid-cols-[auto_1fr_1fr]">
                        <legend className="px-1 text-sm font-semibold">{copy.landingOption(index + 1)}</legend>
                        <label className="block space-y-1 text-sm">
                          <span>বাংলা</span>
                          <input name={`option-${index}-bn`} required maxLength={160} defaultValue={option.bn} className="block w-full rounded border border-sapphire/25 bg-paper p-3 text-ink" lang="bn" />
                        </label>
                        <label className="block space-y-1 text-sm">
                          <span>English</span>
                          <input name={`option-${index}-en`} required maxLength={160} defaultValue={option.en} className="block w-full rounded border border-sapphire/25 bg-paper p-3 text-ink" lang="en" />
                        </label>
                      </fieldset>
                    ))}
                  </div>
                  <label className="block max-w-md space-y-1 text-sm">
                    <span>{copy.landingCorrectOption}</span>
                    <select name="correctIndex" required defaultValue={String(quiz.correctIndex)} className="block w-full rounded border border-sapphire/25 bg-paper p-3 text-ink">
                      {[0, 1, 2, 3].map((index) => (
                        <option key={index} value={index}>{copy.landingOption(index + 1)}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span>{copy.landingExplanation} · বাংলা</span>
                      <textarea name="explanation-bn" required maxLength={600} rows={3} defaultValue={quiz.explanation.bn} className="block w-full rounded border border-sapphire/25 bg-paper p-3 text-ink" lang="bn" />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span>{copy.landingExplanation} · English</span>
                      <textarea name="explanation-en" required maxLength={600} rows={3} defaultValue={quiz.explanation.en} className="block w-full rounded border border-sapphire/25 bg-paper p-3 text-ink" lang="en" />
                    </label>
                  </div>
                  <Button type="submit" disabled={busy}>{copy.saveAndPublishLandingQuiz}</Button>
                </Card>
              )) : (
                <div className="space-y-3">
                  {landingQuizzes.map((quiz) => (
                    <Card key={quiz.slot}>
                      <h3 className="font-semibold">{copy.landingQuizSlot(quiz.slot)} · {quiz.question[lang]}</h3>
                    </Card>
                  ))}
                  <p className="text-sm text-ink/70">{copy.viewerAllowed}</p>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === 'lessons' ? (
          <section id="admin-panel-lessons" role="tabpanel" aria-labelledby="admin-tab-lessons" className="space-y-4">
            <h2 className="text-2xl font-semibold">{copy.lessons}</h2>
            {['editor', 'owner'].includes(adminStatus.role) ? (
              <>
              {isOwner ? (
                <Card className="space-y-3">
                  <p>{copy.dailyAiDrafts}</p>
                  <label className="block space-y-1 text-sm font-medium">
                    <span>{copy.context}</span>
                    <textarea
                      value={draftContext}
                      onChange={(event) => setDraftContext(event.target.value)}
                      maxLength={3000}
                      rows={3}
                      placeholder={copy.contextPlaceholder}
                      className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink"
                    />
                  </label>
                  <Button disabled={busy} onClick={generateAiDrafts}><AiBadge lang={lang} /><span className="ml-2">{copy.generateAiDrafts}</span></Button>
                </Card>
              ) : null}
              <Button disabled={busy} onClick={() => setLessonFormOpen((current) => !current)}>{copy.createLessonButton}</Button>
              {lessonFormOpen ? (
              <Card as="form" className="space-y-4" onSubmit={createLesson}>
                <h3 className="text-xl font-semibold">{copy.createDraft}</h3>
                <div className="max-w-xl">
                  <label className="block space-y-1">
                    <span>{copy.slug}</span>
                    <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength="80" className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink" />
                    <span className="text-sm">{copy.slugHelp}</span>
                  </label>
                </div>
                <LocalizedText name="title" bnLabel={copy.bnTitle} enLabel={copy.enTitle} />
                <LocalizedText name="body" bnLabel={copy.bnBody} enLabel={copy.enBody} multiline />
                <details className="space-y-4">
                  <summary className="cursor-pointer font-semibold">{copy.quizQuestionBn} / {copy.quizQuestionEn}</summary>
                  <LocalizedText name="quizQuestion" bnLabel={copy.quizQuestionBn} enLabel={copy.quizQuestionEn} required={false} />
                  <h4 className="font-semibold">{copy.options}</h4>
                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((index) => (
                      <div key={index} className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
                        <span className="self-center">{copy.option(index + 1)}</span>
                        <input name={`option-${index}-bn`} aria-label={`${copy.option(index + 1)} — বাংলা`} maxLength="120" className="rounded border border-ink/40 bg-paper p-3 text-ink" />
                        <input name={`option-${index}-en`} aria-label={`${copy.option(index + 1)} — English`} maxLength="120" className="rounded border border-ink/40 bg-paper p-3 text-ink" />
                      </div>
                    ))}
                  </div>
                  <label className="block max-w-md space-y-1">
                    <span>{copy.correct}</span>
                    <select name="answerIndex" defaultValue="0" className="block w-full rounded border border-ink/40 bg-paper p-3 text-ink">
                      {[0, 1, 2, 3].map((index) => <option key={index} value={index}>{copy.option(index + 1)}</option>)}
                    </select>
                  </label>
                </details>
                <Button type="submit" disabled={busy}>{copy.create}</Button>
              </Card>
              ) : null}
              </>
            ) : (
              <p>{copy.viewerAllowed}</p>
            )}

            {lessons.length ? (
              <div className="overflow-x-auto rounded-2xl border border-gold/25 bg-paper/90 shadow-md">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead><tr className="border-b border-gold/20 bg-sapphire/15 text-[11px] font-black uppercase tracking-wider text-gold-soft">
                    <th className="p-3">{copy.slug}</th><th className="p-3">{copy.status}</th>
                    <th className="p-3">{copy.author}</th><th className="p-3">{copy.created}</th><th className="p-3">{copy.media}</th><th className="p-3">{copy.actions}</th>
                  </tr></thead>
                  <tbody>{lessons.map((lesson) => {
                  const authoredByMe = lesson.authorId === user.id;
                  const canPublish = !authoredByMe || (lesson.aiDrafted && isOwner);
                  return (
                    <Fragment key={lesson.id}>
                    <tr className="border-t border-sapphire/20">
                      <td className="p-3 font-semibold">{lesson.slug}{lesson.aiDrafted ? <span className="ml-2 inline-flex"><span className="ai-lightmark" role="img" aria-label={copy.aiDraft} title={copy.aiDraft}><span className="ai-lightmark__text">AI</span></span></span> : null}</td>
                      <td className="p-3"><StatusChip lang={lang} status={lesson.status} /></td>
                      <td className="break-all p-3">{lesson.authorId}</td>
                      <td className="p-3">{new Date(lesson.createdAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en')}</td>
                      <td className="p-3">
                        {lesson.media?.type === 'image' ? <img src={lesson.media.url} alt={lesson.slug} className="mb-2 max-h-24 max-w-40 rounded object-contain" /> : null}
                        {lesson.media?.type === 'video' ? <video src={lesson.media.url} controls className="mb-2 max-h-24 max-w-40 rounded" /> : null}
                        {lesson.media?.type === 'audio' ? <audio src={lesson.media.url} controls className="mb-2 max-w-60" /> : null}
                        {['editor', 'owner'].includes(adminStatus.role) ? (
                          <div className="space-y-2">
                            <label className="block text-sm">
                              <span className="sr-only">{copy.chooseMedia}: {lesson.slug}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/aac,audio/ogg,audio/x-m4a"
                                aria-label={`${copy.chooseMedia}: ${lesson.slug}`}
                                disabled={busy}
                                onChange={(event) => setMediaFiles((current) => ({ ...current, [lesson.slug]: event.target.files?.[0] }))}
                              />
                            </label>
                            <p className="text-xs">{copy.mediaHelp}</p>
                            <Button variant="secondary" disabled={busy || !mediaFiles[lesson.slug]} onClick={() => uploadLessonMedia(lesson.slug)}>{copy.uploadMedia}</Button>
                            {lesson.media ? <Button variant="secondary" disabled={busy} onClick={() => removeLessonMedia(lesson.slug)}>{copy.removeMedia}</Button> : null}
                          </div>
                        ) : lesson.media ? null : <span>—</span>}
                      </td>
                      <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {['editor', 'owner'].includes(adminStatus.role) ? (
                          <Button variant="secondary" disabled={busy} onClick={() => setEditingLessonId((current) => current === lesson.id ? '' : lesson.id)}>
                            {copy.editLesson}
                          </Button>
                        ) : null}
                        {lesson.status === 'draft' && ['editor', 'owner'].includes(adminStatus.role) ? (
                          <Button variant="secondary" disabled={busy || !authoredByMe} title={!authoredByMe ? copy.submitSelfOnly : undefined} onClick={() => lessonAction(lesson.slug, 'submit')}>{copy.submitReview}</Button>
                        ) : null}
                        {lesson.status === 'review' && ['editor', 'owner'].includes(adminStatus.role) ? (
                          <Button disabled={busy || !canPublish} title={!canPublish ? copy.secondPerson : undefined} onClick={() => lessonAction(lesson.slug, 'publish')}>{copy.publish}</Button>
                        ) : null}
                        {lesson.status !== 'archived' && isOwner ? (
                          <Button variant="secondary" disabled={busy} onClick={() => {
                            if (globalThis.confirm(copy.archive)) lessonAction(lesson.slug, 'archive');
                          }}>{copy.archive}</Button>
                        ) : null}
                        {lesson.status === 'review' && authoredByMe && !canPublish ? <p className="self-center text-sm">{copy.secondPerson}</p> : null}
                      </div>
                      </td>
                    </tr>
                    {editingLessonId === lesson.id ? (
                      <tr className="border-t border-sapphire/20">
                        <td colSpan={6} className="p-3">
                          <LessonEditorForm
                            key={lesson.id}
                            lesson={lesson}
                            copy={copy}
                            busy={busy}
                            onCancel={() => setEditingLessonId('')}
                            onSave={(data) => updateLesson(lesson.slug, data)}
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  );
                })}</tbody>
                </table>
              </div>
            ) : <Card>{copy.noLessons}</Card>}
          </section>
          ) : null}

          {activeTab === 'audit' ? <section id="admin-panel-audit" role="tabpanel" aria-labelledby="admin-tab-audit" className="space-y-3">
            <h2 className="text-2xl font-semibold">{copy.auditTitle}</h2>
            {audit.length ? (
              <div className="overflow-x-auto rounded-2xl border border-gold/25 bg-paper/90 shadow-md">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead><tr className="border-b border-gold/20 bg-sapphire/15 text-[11px] font-black uppercase tracking-wider text-gold-soft">
                    <th className="p-3">{copy.action}</th><th className="p-3">{copy.actor}</th>
                    <th className="p-3">{copy.timestamp}</th><th className="p-3">{copy.summary}</th>
                  </tr></thead>
                  <tbody>
                    {audit.map((entry) => (
                      <tr key={entry.id} className="border-t border-sapphire/20">
                        <td className="p-3">{entry.action} · {entry.actorRole}</td>
                        <td className="break-all p-3">{entry.actorId || 'CLI'}</td>
                        <td className="p-3">{new Date(entry.createdAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en')}</td>
                        <td className="p-3">{entry.targetType} {entry.targetId} {entry.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : auditLoaded ? <Card>{copy.noAudit}</Card> : null}
            {auditCursor ? <Button variant="secondary" disabled={busy} onClick={() => perform(() => loadAudit(auditCursor, true))}>{copy.more}</Button> : null}
          </section>
          : null}

          {activeTab === 'users' ? (
            <section id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users" className="space-y-4">
              {isOwner ? (
                <>
                  <Card className="space-y-4 border border-gold/40 bg-paper/95 p-5 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl" aria-hidden="true">👥</span>
                        <div>
                          <h2 className="text-xl font-bold text-ink">{copy.usersHeading}</h2>
                          <p className="text-xs text-ink/70">{copy.usersHelp}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-black text-gold-soft">
                        {copy.allUsersCount(users.length)}
                      </span>
                    </div>

                    <form onSubmit={handleSearchUsers} className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="search"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder={copy.searchUsersPlaceholder}
                        className="polished-input min-w-[240px] flex-1 rounded-xl border border-ink/20 bg-paper p-2.5 text-sm font-semibold text-ink focus:border-gold focus:outline-none"
                      />
                      <Button type="submit" disabled={busy || loadingUsers} className="primary-button min-h-[42px] px-4 text-xs font-bold">
                        {loadingUsers ? '...' : `🔍 ${copy.searchUsers}`}
                      </Button>
                      {userSearch ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setUserSearch('');
                            void loadUsers('');
                          }}
                          className="min-h-[42px] px-3 text-xs font-bold"
                        >
                          ✕
                        </Button>
                      ) : null}
                    </form>
                  </Card>

                  {users.length ? (
                    <div className="overflow-x-auto rounded-2xl border border-gold/25 bg-paper/90 shadow-md">
                      <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-gold/20 bg-sapphire/15 text-[11px] font-black uppercase tracking-wider text-gold-soft">
                            <th className="p-3.5">{copy.userDisplayName}</th>
                            <th className="p-3.5">{copy.userEmail}</th>
                            <th className="p-3.5">{copy.userRole}</th>
                            <th className="p-3.5">{copy.userStatus}</th>
                            <th className="p-3.5">{copy.userJoined}</th>
                            <th className="p-3.5 text-right">{copy.actions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => {
                            const isSelf = String(u.id) === String(user?.id);
                            return (
                              <tr key={u.id} className="border-t border-ink/10 transition-colors hover:bg-gold/5">
                                <td className="p-3.5 font-bold text-ink">
                                  <div className="flex items-center gap-2">
                                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/15 text-xs font-black text-gold-soft">
                                      {u.displayName?.charAt(0)?.toUpperCase() || '👤'}
                                    </span>
                                    <span className="truncate max-w-[130px] sm:max-w-xs">{u.displayName}</span>
                                  </div>
                                </td>
                                <td className="p-3.5 text-ink/80 font-mono text-xs">{u.email}</td>
                                <td className="p-3.5">
                                  {isSelf ? (
                                    <span className="rounded-lg border border-gold/40 bg-gold/15 px-2.5 py-1 text-xs font-black text-gold-soft">
                                      {u.role.toUpperCase()}
                                    </span>
                                  ) : (
                                    <select
                                      value={u.role}
                                      disabled={busy}
                                      onChange={(e) => void updateUserRoleDirectly(u.id, e.target.value)}
                                      className="rounded-lg border border-ink/20 bg-paper px-2 py-1 text-xs font-bold text-ink focus:border-gold focus:outline-none"
                                    >
                                      {ROLES.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  {u.isRestricted ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-xs font-black text-rose-600">
                                      <span>●</span> {copy.statusRestricted}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-black text-emerald-600">
                                      <span>●</span> {copy.statusActive}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5 text-xs text-ink/60">
                                  {new Date(u.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en')}
                                </td>
                                <td className="p-3.5 text-right">
                                  {isSelf ? (
                                    <span className="text-[11px] font-bold text-ink/40">({copy.cannotModifySelf})</span>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={() => void toggleUserRestriction(u)}
                                        className={`min-h-[34px] px-2.5 py-1 text-xs font-black transition-all ${
                                          u.isRestricted
                                            ? 'border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10'
                                            : 'border-amber-500/50 text-amber-600 hover:bg-amber-500/10'
                                        }`}
                                      >
                                        {u.isRestricted ? `✅ ${copy.unrestrictUser}` : `🚫 ${copy.restrictUser}`}
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={() => void deleteUserAccount(u)}
                                        className="min-h-[34px] border-rose-500/40 px-2.5 py-1 text-xs font-black text-rose-600 hover:bg-rose-500/10 transition-all"
                                      >
                                        🗑️ {copy.deleteUser}
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Card className="text-center py-6">
                      <p className="text-sm font-semibold text-ink/60">{copy.noUsersFound}</p>
                    </Card>
                  )}
                </>
              ) : <Card>{copy.accessRestricted}</Card>}
            </section>
          ) : null}

          {activeTab === 'broadcast' ? (
            <section id="admin-panel-broadcast" role="tabpanel" aria-labelledby="admin-tab-broadcast" className="space-y-5">
              <Card className="space-y-4 border border-gold/40 bg-paper/95 p-5 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl" aria-hidden="true">📢</span>
                  <div>
                    <h2 className="text-xl font-bold text-ink">{copy.broadcastHeading}</h2>
                    <p className="text-xs text-ink/70">{copy.broadcastHelp}</p>
                  </div>
                </div>

                <form onSubmit={sendBroadcastNotification} className="space-y-4">
                  <label className="block space-y-1.5 text-xs font-bold text-ink">
                    <span>{copy.broadcastTitle}</span>
                    <input
                      type="text"
                      required
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      maxLength={100}
                      placeholder={copy.broadcastTitlePlaceholder}
                      className="polished-input block w-full rounded-xl border border-ink/20 bg-paper p-3 text-sm text-ink font-semibold focus:border-gold focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1.5 text-xs font-bold text-ink">
                    <span>{copy.broadcastBody}</span>
                    <textarea
                      required
                      rows={4}
                      value={broadcastBody}
                      onChange={(e) => setBroadcastBody(e.target.value)}
                      maxLength={500}
                      placeholder={copy.broadcastBodyPlaceholder}
                      className="polished-input block w-full rounded-xl border border-ink/20 bg-paper p-3 text-sm text-ink font-semibold focus:border-gold focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1.5 text-xs font-bold text-ink">
                    <span>{copy.broadcastUrl}</span>
                    <input
                      type="text"
                      value={broadcastUrl}
                      onChange={(e) => setBroadcastUrl(e.target.value)}
                      maxLength={500}
                      placeholder="/today"
                      className="polished-input block w-full rounded-xl border border-ink/20 bg-paper p-3 text-sm text-ink font-semibold focus:border-gold focus:outline-none"
                    />
                  </label>

                  <Button
                    type="submit"
                    disabled={sendingBroadcast || busy}
                    className="primary-button min-h-[46px] w-full sm:w-auto px-6 py-2.5 text-sm font-bold shadow-md"
                  >
                    {sendingBroadcast ? copy.broadcastSending : copy.broadcastSend}
                  </Button>
                </form>
              </Card>

              <Card className="space-y-3 p-5">
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <span aria-hidden="true">📋</span> {copy.broadcastHistory}
                </h3>
                {broadcasts.length ? (
                  <div className="space-y-3">
                    {broadcasts.map((item) => (
                      <div key={item.id} className="rounded-xl border border-ink/10 bg-paper/60 p-3.5 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-gold-soft">{item.title}</h4>
                          <span className="text-[11px] text-ink/60 font-medium">
                            {new Date(item.createdAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en')}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-ink leading-relaxed">{item.body}</p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold text-ink/60">
                          <span>🎯 {item.url}</span>
                          <span>📱 {lang === 'bn' ? `ডেলিভারি: ${item.deliveredCount}টি ডিভাইস` : `Delivered: ${item.deliveredCount} devices`}</span>
                          {item.creator ? <span>👤 {item.creator}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink/60">{copy.noBroadcasts}</p>
                )}
              </Card>
            </section>
          ) : null}

          {activeTab === 'maintenance' ? (
            <section id="admin-panel-maintenance" role="tabpanel" aria-labelledby="admin-tab-maintenance" className="space-y-4">
              {isOwner ? (
                <>
                  <Card className="space-y-3">
                    <h2 className="text-xl font-semibold">{copy.cleanup}</h2>
                    <Button disabled={busy} onClick={runCleanup}>{copy.cleanup}</Button>
                  </Card>
                  <div className="grid gap-4 md:grid-cols-2">
                    {FLAG_KEYS.map((key) => flags[key] ? (
                      <Card as="form" key={key} className="space-y-3" onSubmit={(event) => saveFlag(event, key)}>
                        <h2 className="text-lg font-semibold">{FLAG_LABELS[key][lang]}</h2>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={flags[key].enabled}
                            onChange={(event) => setFlags((current) => ({ ...current, [key]: { ...current[key], enabled: event.target.checked } }))}
                          />
                          {copy.enabled}
                        </label>
                        <Field
                          label={copy.flagRollout}
                          type="number"
                          required
                          min="0"
                          max="100"
                          step="1"
                          value={flags[key].rolloutPercent}
                          onChange={(event) => setFlags((current) => ({ ...current, [key]: { ...current[key], rolloutPercent: event.target.value } }))}
                        />
                        <Button type="submit" disabled={busy}>{copy.saveFlag}</Button>
                      </Card>
                    ) : null)}
                  </div>
                </>
              ) : <Card>{copy.accessRestricted}</Card>}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
