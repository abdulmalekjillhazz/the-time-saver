// Short interface labels used by the design-system components. Bangla is draft until a native speaker reviews it.
export const UI = {
  en: {
    aiBadge: 'AM',
    status: {
      done: 'Done',
      missed: 'Missed',
      skipped: 'Skipped',
      draft: 'Draft',
      review: 'In review',
      published: 'Published',
      archived: 'Archived',
    },
  },
  bn: {
    aiBadge: 'AM',
    status: {
      done: 'সম্পন্ন',
      missed: 'বাদ গেছে',
      skipped: 'এড়িয়ে গেছেন',
      draft: 'খসড়া',
      review: 'পর্যালোচনাধীন',
      published: 'প্রকাশিত',
      archived: 'আর্কাইভ',
    },
  },
};

export const getUi = (lang) => UI[lang];
