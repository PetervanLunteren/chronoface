import clsx from "clsx";
import type { FaceItem } from "../api/types";

interface FaceThumbProps {
  face: FaceItem;
  selected: boolean;
  onToggle: (face: FaceItem) => void;
}

function FaceThumb({ face, selected, onToggle }: FaceThumbProps) {
  const state = face.accepted === true ? "accepted" : face.accepted === false ? "rejected" : "pending";
  return (
    <button
      type="button"
      className={clsx(
        "group relative aspect-square overflow-hidden rounded border",
        selected ? "border-primary" : "border-slate-800",
        "bg-slate-900"
      )}
      aria-label={`Face ${face.face_id}`}
      onClick={() => onToggle(face)}
    >
      <img src={face.thumb_url} alt="Face" className="h-full w-full object-cover" loading="lazy" />
      <span
        className={clsx(
          "absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-left text-[10px] uppercase tracking-wide",
          {
            "text-emerald-300": state === "accepted",
            "text-rose-300": state === "rejected",
            "text-slate-200": state === "pending"
          }
        )}
      >
        {state}
      </span>
    </button>
  );
}

export default FaceThumb;
