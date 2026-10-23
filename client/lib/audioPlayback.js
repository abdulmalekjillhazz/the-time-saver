let activePlayback = null;

export function stopActiveAudioPlayback() {
  const previous = activePlayback;
  activePlayback = null;
  previous?.stop();
}

export function claimAudioPlayback(stop) {
  stopActiveAudioPlayback();
  const playback = { stop };
  activePlayback = playback;
  return () => {
    if (activePlayback === playback) activePlayback = null;
  };
}