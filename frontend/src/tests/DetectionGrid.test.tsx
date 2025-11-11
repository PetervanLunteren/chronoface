import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DetectionGrid from "../components/DetectionGrid";
import type { FaceItem } from "../api/types";

const faces: FaceItem[] = Array.from({ length: 3 }).map((_, index) => ({
  face_id: `face${index}`,
  photo_id: `photo${index}`,
  bucket: "2024-03",
  bbox: [0, 0, 64, 64],
  size_px: 64,
  embedding_id: `embed${index}`,
  cluster_id: index === 0 ? "cluster_1" : "cluster_2",
  accepted: null,
  thumb_url: `/thumb${index}.jpg`,
  photo_path: `/photo${index}.jpg`
}));

test("Detection grid toggles selection", async () => {
  const user = userEvent.setup();
  const selected: string[] = [];
  const handleToggle = (face: FaceItem) => {
    const index = selected.indexOf(face.face_id);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(face.face_id);
    }
  };
  render(
    <DetectionGrid
      faces={faces}
      selectedIds={selected}
      onToggle={handleToggle}
      onAccept={() => undefined}
      onReject={() => undefined}
    />
  );
  await user.click(screen.getByLabelText(/face face0/i));
  expect(selected).toContain("face0");
});
