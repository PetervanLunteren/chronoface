import type { FaceItem } from "../api/types";
import FaceThumb from "./FaceThumb";

interface DetectionGridProps {
  faces: FaceItem[];
  selectedIds: string[];
  onToggle: (face: FaceItem) => void;
  onAccept: () => void;
  onReject: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
}

function DetectionGrid({ faces, selectedIds, onToggle, onAccept, onReject, onMerge, onSplit }: DetectionGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{faces.length} faces</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selectedIds.length}
            onClick={onAccept}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={!selectedIds.length}
            onClick={onReject}
            className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject
          </button>
          {onMerge && (
            <button
              type="button"
              disabled={selectedIds.length < 2}
              onClick={onMerge}
              className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Merge clusters
            </button>
          )}
          {onSplit && (
            <button
              type="button"
              disabled={!selectedIds.length}
              onClick={onSplit}
              className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Split cluster
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {faces.map((face) => (
          <FaceThumb
            key={face.face_id}
            face={face}
            selected={selectedIds.includes(face.face_id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

export default DetectionGrid;
