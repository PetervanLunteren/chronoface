interface ProgressBarProps {
  processed: number;
  total: number;
  message?: string;
  startTime?: number;
}

function ProgressBar({ processed, total, startTime }: ProgressBarProps) {
  const ratio = total > 0 ? Math.min(1, processed / total) : 0;
  const percent = Math.round(ratio * 100);

  // Calculate ETA
  let etaText = "";
  if (startTime && processed > 0 && processed < total) {
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    const rate = processed / elapsed; // items per second
    const remaining = total - processed;
    const etaSeconds = remaining / rate;

    if (etaSeconds < 60) {
      etaText = `ETA: ${Math.round(etaSeconds)}s`;
    } else {
      const minutes = Math.floor(etaSeconds / 60);
      const seconds = Math.round(etaSeconds % 60);
      etaText = `ETA: ${minutes}m ${seconds}s`;
    }
  }

  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
        <div
          className="h-full rounded bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{processed}/{total} processed</span>
        <span>{etaText}</span>
      </div>
    </div>
  );
}

export default ProgressBar;
