export function getRoutineMood(startTime, endTime) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    return { mood: 'neutral', durationMinutes: null };
  }

  const toMinutes = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const durationMinutes = (toMinutes(endTime) - toMinutes(startTime) + 1440) % 1440;
  if (durationMinutes > 240) return { mood: 'angry', durationMinutes };
  if (durationMinutes > 60) return { mood: 'happy', durationMinutes };
  return { mood: 'neutral', durationMinutes };
}
