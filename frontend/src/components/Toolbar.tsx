import { Link } from "react-router-dom";

import { useRunStore } from "../state/useRunStore";

function Toolbar() {
  const { runId, phase, progress } = useRunStore((state) => ({
    runId: state.runId,
    phase: state.phase,
    progress: state.progress
  }));

  if (!runId) {
    return null;
  }

  return (
    <div className="border-b border-slate-800 bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-6 py-3 text-xs text-slate-300 md:flex-row md:items-center">
        <span>
          Run <code className="rounded bg-slate-800 px-2 py-1">{runId.slice(0, 8)}</code> · Phase {phase}
        </span>
        <span>
          {progress.processed}/{progress.total} processed {progress.message && `· ${progress.message}`}
        </span>
        <span className="flex gap-3 text-primary">
          <Link to="/review">Review</Link>
          <Link to="/collage">Collage</Link>
        </span>
      </div>
    </div>
  );
}

export default Toolbar;
