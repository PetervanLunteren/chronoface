import type { FaceItem } from "../api/types";

interface ClusterPanelProps {
  faces: FaceItem[];
}

function ClusterPanel({ faces }: ClusterPanelProps) {
  const clusters = faces.reduce<Record<string, FaceItem[]>>((acc, face) => {
    const key = face.cluster_id ?? "unassigned";
    acc[key] = acc[key] || [];
    acc[key].push(face);
    return acc;
  }, {});

  const clusterEntries = Object.entries(clusters).sort((a, b) => b[1].length - a[1].length);

  return (
    <aside className="space-y-3 rounded border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-200">Clusters</h3>
      <ul className="space-y-2 text-xs">
        {clusterEntries.map(([clusterId, items]) => {
          const accepted = items.filter((face) => face.accepted === true).length;
          const rejected = items.filter((face) => face.accepted === false).length;
          return (
            <li key={clusterId} className="rounded border border-slate-800 px-3 py-2">
              <p className="font-semibold text-slate-100">{clusterId}</p>
              <p className="text-slate-400">
                {items.length} faces · {accepted} accepted · {rejected} rejected
              </p>
            </li>
          );
        })}
        {!clusterEntries.length && <li className="text-slate-500">No faces detected yet.</li>}
      </ul>
    </aside>
  );
}

export default ClusterPanel;
