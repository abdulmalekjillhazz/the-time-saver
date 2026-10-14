export default function manifest() {
  return {
    name: 'Smart Routine — Daily Routine Planner & Habit Coach',
    short_name: 'Smart Routine',
    description: 'Plan your day with flexible routines, reminders, focus tools, and bilingual habit lessons in Bangla and English.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#061b12',
    theme_color: '#22a95a',
    categories: ['productivity', 'education', 'lifestyle'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
