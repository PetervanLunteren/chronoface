import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAllFaces, submitReview } from "../api/client";
import type { FaceItem } from "../api/types";
import { useRunStore } from "../state/useRunStore";

function Review() {
  const {
    runId,
    setCurrentStep,
    pushToast,
    selectedFaceIds,
    setSelectedFaceIds
  } = useRunStore((state) => ({
    runId: state.runId,
    setCurrentStep: state.setCurrentStep,
    pushToast: state.pushToast,
    selectedFaceIds: state.selectedFaceIds,
    setSelectedFaceIds: state.setSelectedFaceIds
  }));

  const [selectedIds, setSelectedIds] = useState<string[]>(selectedFaceIds);
  const [showHelp, setShowHelp] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  const helpRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Close help popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(event.target as Node)) {
        setShowHelp(false);
      }
    };
    if (showHelp) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showHelp]);

  const facesQuery = useQuery({
    queryKey: ["all-faces", runId],
    queryFn: async () => {
      if (!runId) return null;
      const response = await getAllFaces(runId);

      // Only set initial selection if we don't have a saved selection
      if (selectedFaceIds.length === 0) {
        // Initially select faces with confidence >= 75%
        const highConfidenceFaces = response.faces.filter(f => f.score * 100 >= 75);
        const initialIds = highConfidenceFaces.map(f => f.face_id);
        setSelectedIds(initialIds);
        setSelectedFaceIds(initialIds);
      } else {
        // Restore saved selection
        setSelectedIds(selectedFaceIds);
      }

      return response;
    },
    enabled: Boolean(runId)
  });

  // Sort faces by confidence (highest first)
  const faces = [...(facesQuery.data?.faces || [])].sort((a, b) => {
    return b.score - a.score; // Highest confidence first
  });


  const toggleFace = (faceId: string, index: number, event?: React.MouseEvent) => {
    // Ctrl/Cmd+Shift+click for range deselection
    if (event?.shiftKey && (event?.ctrlKey || event?.metaKey) && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeIds = faces.slice(start, end + 1).map(f => f.face_id);

      // Remove all faces in range from selection
      setSelectedIds(prev => prev.filter(id => !rangeIds.includes(id)));
    }
    // Shift+click for range selection
    else if (event?.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeIds = faces.slice(start, end + 1).map(f => f.face_id);

      // Add all faces in range to selection
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        rangeIds.forEach(id => newSet.add(id));
        return Array.from(newSet);
      });
    } else {
      // Normal toggle
      setSelectedIds(prev =>
        prev.includes(faceId)
          ? prev.filter(id => id !== faceId)
          : [...prev, faceId]
      );
    }
    setLastClickedIndex(index);
  };

  const selectAll = () => {
    setSelectedIds(faces.map(f => f.face_id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const selectByConfidence = () => {
    const highConfidenceFaces = faces.filter(f => f.score * 100 >= confidenceThreshold);
    setSelectedIds(highConfidenceFaces.map(f => f.face_id));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.face-item')) {
      return; // Don't start drag on face items
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !gridRef.current) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    const faceElements = gridRef.current.querySelectorAll('.face-item');

    const minX = Math.min(dragStart.x, e.clientX);
    const maxX = Math.max(dragStart.x, e.clientX);
    const minY = Math.min(dragStart.y, e.clientY);
    const maxY = Math.max(dragStart.y, e.clientY);

    const facesInSelection: string[] = [];
    faceElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const faceCenterX = rect.left + rect.width / 2;
      const faceCenterY = rect.top + rect.height / 2;

      if (faceCenterX >= minX && faceCenterX <= maxX && faceCenterY >= minY && faceCenterY <= maxY) {
        const faceId = el.getAttribute('data-face-id');
        if (faceId) facesInSelection.push(faceId);
      }
    });

    setSelectedIds(facesInSelection);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleAcceptSelected = async () => {
    if (!runId) return;
    try {
      // Save selection to store
      setSelectedFaceIds(selectedIds);

      await submitReview({
        run_id: runId,
        accept: selectedIds,
        reject: [],
        accept_clusters: [],
        reject_clusters: [],
        merge_clusters: [],
        split_clusters: [],
      });
      pushToast({
        title: `${selectedIds.length} face${selectedIds.length !== 1 ? 's' : ''} accepted`,
        description: "Moving to configuration..."
      });
      setTimeout(() => setCurrentStep(3), 1000);
    } catch (error) {
      pushToast({ title: "Review failed", description: String(error), variant: "error" });
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">
          Review detected faces
        </h1>
        {faces.length > 0 && (
          <p className="text-sm text-slate-400">
            {faces.length} {faces.length === 1 ? "face" : "faces"} detected
          </p>
        )}
      </div>

      {!runId && (
        <p className="text-sm text-slate-400">Start a scan to review faces.</p>
      )}

      {runId && facesQuery.isLoading && (
        <p className="text-sm text-slate-400">Loading faces...</p>
      )}

      {runId && faces.length === 0 && !facesQuery.isLoading && (
        <p className="text-sm text-slate-400">No faces detected.</p>
      )}

      {runId && faces.length > 0 && (
        <div className="space-y-6">
          {/* Selection controls */}
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-300">
                  {selectedIds.length} of {faces.length} selected
                </span>
                <button
                  onClick={selectAll}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Deselect all
                </button>
                <span className="text-slate-600">|</span>
                <label className="text-sm text-slate-400">Select by confidence:</label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="w-32 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-sm text-slate-300 w-12">&ge; {confidenceThreshold}%</span>
                <button
                  onClick={selectByConfidence}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Apply
                </button>
                <div className="relative" ref={helpRef}>
                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="flex items-center justify-center w-5 h-5 rounded-full border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors text-xs"
                    title="Help"
                  >
                    ?
                  </button>
                  {showHelp && (
                    <div className="absolute left-0 top-8 z-50 w-96 rounded-lg border border-slate-700 bg-slate-800 p-4 shadow-xl">
                      <h3 className="text-sm font-semibold text-white mb-3">How to select faces</h3>
                      <div className="space-y-2 text-xs text-slate-300">
                        <div>
                          <span className="font-semibold text-white">Click:</span> Toggle single face on/off
                        </div>
                        <div>
                          <span className="font-semibold text-white">Shift + Click:</span> Select range between two faces
                        </div>
                        <div>
                          <span className="font-semibold text-white">Ctrl/Cmd + Shift + Click:</span> Deselect range between two faces
                        </div>
                        <div>
                          <span className="font-semibold text-white">Drag:</span> Draw over empty space to select multiple faces at once
                        </div>
                        <div>
                          <span className="font-semibold text-white">Select all:</span> Select all detected faces
                        </div>
                        <div>
                          <span className="font-semibold text-white">Deselect all:</span> Clear all selections
                        </div>
                        <div>
                          <span className="font-semibold text-white">Confidence filter:</span> Select only faces with confidence above threshold
                        </div>
                        <div className="pt-2 border-t border-slate-700 mt-3">
                          <p className="text-slate-400">
                            Selected faces (with blue border) will be included in the collage.
                            Deselected faces (dimmed) will be excluded.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleAcceptSelected}
                disabled={selectedIds.length === 0}
                className="rounded bg-primary px-6 py-2 font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue with {selectedIds.length} {selectedIds.length === 1 ? "face" : "faces"}
              </button>
            </div>
          </div>

          {/* Faces grid */}
          <div
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div ref={gridRef} className="grid grid-cols-4 gap-4 md:grid-cols-6 lg:grid-cols-8">
              {faces.map((face, index) => {
                const isSelected = selectedIds.includes(face.face_id);
                const confidencePercent = Math.round(face.score * 100);

                return (
                  <div
                    key={face.face_id}
                    data-face-id={face.face_id}
                    onClick={(e) => toggleFace(face.face_id, index, e)}
                    className={`face-item relative overflow-hidden rounded border cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <img
                      src={face.thumb_url}
                      alt={`Face ${face.face_id}`}
                      className={`aspect-square w-full object-cover transition-opacity ${
                        isSelected ? "opacity-100" : "opacity-50"
                      }`}
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {/* Confidence badge */}
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-xs text-slate-300 font-semibold">
                      {confidencePercent}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between border-t border-slate-800 pt-6">
            <button
              onClick={() => setCurrentStep(1)}
              className="rounded border border-slate-700 bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Back to Scan
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Review;
