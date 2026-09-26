export function formatSeconds(seconds: number, includeMs = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const ms = Math.floor((seconds % 1) * 10);

  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const hrsStr = hrs.toString().padStart(2, '0');
    return includeMs ? `${hrsStr}:${minsStr}:${secsStr}.${ms}` : `${hrsStr}:${minsStr}:${secsStr}`;
  }

  return includeMs ? `${minsStr}:${secsStr}.${ms}` : `${minsStr}:${secsStr}`;
}

export function formatDurationLabel(seconds: number): string {
  if (seconds < 60) {
    return `${Number(seconds.toFixed(1))}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.round(seconds % 60);
  if (remSecs === 0) return `${mins}m`;
  return `${mins}m ${remSecs}s`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
