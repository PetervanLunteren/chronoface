import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllFaces } from "../api/client";
import type { BucketSize } from "../api/types";
import { useRunStore } from "../state/useRunStore";

interface BucketWithFaces {
  key: string;
  label: string;
  faces: Array<{
    face_id: string;
    thumb_url: string;
    score: number;
  }>;
  selectedFaceId: string | null;
}

function Arrange() {
  const {
    runId,
    setCurrentStep,
    pushToast,
    selectedBucketType,
    bucketFaceSelections,
    setBucketFaceSelections,
  } = useRunStore((state) => ({
    runId: state.runId,
    setCurrentStep: state.setCurrentStep,
    pushToast: state.pushToast,
    selectedBucketType: state.selectedBucketType,
    bucketFaceSelections: state.bucketFaceSelections,
    setBucketFaceSelections: state.setBucketFaceSelections,
  }));

  const facesQuery = useQuery({
    queryKey: ["all-faces", runId],
    queryFn: async () => {
      if (!runId) return null;
      return await getAllFaces(runId);
    },
    enabled: Boolean(runId),
  });

  const faces = facesQuery.data?.faces || [];

  // Re-bucket faces based on timestamps and selected bucket type
  const bucketsWithFaces = useMemo((): BucketWithFaces[] => {
    if (!selectedBucketType || selectedBucketType === "all") return [];

    const acceptedFaces = faces.filter(f => f.accepted);
    if (acceptedFaces.length === 0) return [];

    const getBucketKey = (timestamp: string, bucketType: BucketSize): string => {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if (bucketType === "year") {
        return `${year}`;
      } else if (bucketType === "month") {
        return `${year}-${String(month).padStart(2, "0")}`;
      } else if (bucketType === "week") {
        const firstDayOfYear = new Date(year, 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        return `${year}-W${String(week).padStart(2, "0")}`;
      } else if (bucketType === "day") {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
      return "";
    };

    const getBucketLabel = (key: string, bucketType: BucketSize): string => {
      if (bucketType === "year") {
        return key;
      } else if (bucketType === "month") {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } else if (bucketType === "week") {
        const [year, week] = key.split("-W");
        return `Week ${week}, ${year}`;
      } else if (bucketType === "day") {
        const [year, month, day] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      return key;
    };

    // Group faces by bucket
    const bucketMap = new Map<string, Array<{ face_id: string; thumb_url: string; score: number }>>();

    acceptedFaces.forEach(face => {
      const key = getBucketKey(face.photo_timestamp, selectedBucketType);
      if (!bucketMap.has(key)) {
        bucketMap.set(key, []);
      }
      bucketMap.get(key)!.push({
        face_id: face.face_id,
        thumb_url: face.thumb_url,
        score: face.score,
      });
    });

    // Convert to array and sort by key
    const bucketsArray: BucketWithFaces[] = Array.from(bucketMap.entries())
      .map(([key, faces]) => ({
        key,
        label: getBucketLabel(key, selectedBucketType),
        faces: faces.sort((a, b) => b.score - a.score), // Sort by confidence, highest first
        selectedFaceId: bucketFaceSelections[key] || faces[0].face_id, // Default to first (highest confidence)
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return bucketsArray;
  }, [faces, selectedBucketType, bucketFaceSelections]);

  // Initialize selections for buckets with multiple faces
  useEffect(() => {
    const initialSelections: Record<string, string> = {};
    bucketsWithFaces.forEach(bucket => {
      if (bucket.faces.length > 1 && !bucketFaceSelections[bucket.key]) {
        initialSelections[bucket.key] = bucket.faces[0].face_id;
      }
    });
    if (Object.keys(initialSelections).length > 0) {
      setBucketFaceSelections({ ...bucketFaceSelections, ...initialSelections });
    }
  }, [bucketsWithFaces]);

  const handleFaceSelection = (bucketKey: string, faceId: string) => {
    setBucketFaceSelections({
      ...bucketFaceSelections,
      [bucketKey]: faceId,
    });
  };

  const handleContinue = () => {
    setCurrentStep(5);
  };

  // Filter to show only buckets with multiple faces
  const bucketsWithMultipleFaces = bucketsWithFaces.filter(b => b.faces.length > 1);
  const bucketsWithSingleFace = bucketsWithFaces.filter(b => b.faces.length === 1);

  return (
    <section className="space-y-6">
      {!runId && (
        <p className="text-sm text-slate-400">Complete previous steps first.</p>
      )}

      {runId && (
        <div className="space-y-6">
          {facesQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading buckets...</p>
          ) : (
            <>
              {bucketsWithMultipleFaces.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <svg className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-white mb-2">All set!</p>
                  <p className="text-slate-400 text-sm">
                    Each slot has exactly one face. No arrangement needed.
                  </p>
                  <p className="text-slate-500 text-xs mt-3">
                    {bucketsWithSingleFace.length} slot{bucketsWithSingleFace.length !== 1 ? 's' : ''} ready
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-300">
                          {bucketsWithMultipleFaces.length} slot{bucketsWithMultipleFaces.length !== 1 ? 's' : ''} with multiple faces
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Select which face to use for each slot
                        </p>
                      </div>
                      {bucketsWithSingleFace.length > 0 && (
                        <p className="text-xs text-slate-500">
                          {bucketsWithSingleFace.length} other slot{bucketsWithSingleFace.length !== 1 ? 's' : ''} have one face
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Buckets with multiple faces */}
                  <div className="space-y-4">
                    {bucketsWithMultipleFaces.map((bucket) => (
                      <div
                        key={bucket.key}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
                      >
                        <h3 className="text-base font-semibold text-white mb-4">
                          {bucket.label}
                        </h3>
                        <div className="grid grid-cols-6 gap-4 md:grid-cols-8 lg:grid-cols-10">
                          {bucket.faces.map((face) => {
                            const isSelected = bucket.selectedFaceId === face.face_id;
                            return (
                              <div
                                key={face.face_id}
                                onClick={() => handleFaceSelection(bucket.key, face.face_id)}
                                className={`relative overflow-hidden rounded border cursor-pointer transition-all ${
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
                                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-xs text-slate-300">
                                  {Math.round(face.score * 100)}%
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between border-t border-slate-800 pt-6">
            <button
              onClick={() => setCurrentStep(3)}
              className="rounded border border-slate-700 bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Back to Configure
            </button>
            <button
              onClick={handleContinue}
              className="rounded bg-primary px-6 py-2 font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Continue to Create
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Arrange;
