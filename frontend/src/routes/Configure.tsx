import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBuckets, getAllFaces } from "../api/client";
import type { BucketSize } from "../api/types";
import { useRunStore } from "../state/useRunStore";

type BucketOption = {
  value: BucketSize | "all";
  label: string;
  description: string;
};

const BUCKET_OPTIONS: BucketOption[] = [
  { value: "day", label: "Daily", description: "One face per day" },
  { value: "week", label: "Weekly", description: "One face per week" },
  { value: "month", label: "Monthly", description: "One face per month" },
  { value: "year", label: "Yearly", description: "One face per year" },
  { value: "all", label: "All faces", description: "Include all selected faces" },
];

const PREVIEW_COLUMNS = 12;
const MAX_PREVIEW_ROWS = 8;

function Configure() {
  const {
    runId,
    setCurrentStep,
    pushToast,
    setSelectedBucketType,
  } = useRunStore((state) => ({
    runId: state.runId,
    setCurrentStep: state.setCurrentStep,
    pushToast: state.pushToast,
    setSelectedBucketType: state.setSelectedBucketType,
  }));

  const [selectedBucket, setSelectedBucket] = useState<BucketSize | "all">("month");

  const facesQuery = useQuery({
    queryKey: ["all-faces", runId],
    queryFn: async () => {
      if (!runId) return null;
      return await getAllFaces(runId);
    },
    enabled: Boolean(runId),
  });

  const bucketsQuery = useQuery({
    queryKey: ["buckets", runId],
    queryFn: async () => {
      if (!runId) return null;
      return await getBuckets(runId);
    },
    enabled: Boolean(runId),
  });

  const faces = facesQuery.data?.faces || [];
  const buckets = bucketsQuery.data || [];

  // Calculate which buckets have faces based on selected bucket type
  const bucketCoverage = useMemo(() => {
    if (selectedBucket === "all") return [];

    const acceptedFaces = faces.filter(f => f.accepted);

    if (acceptedFaces.length === 0) return [];

    // Re-bucket faces based on their timestamps and selected bucket type
    const getBucketKey = (timestamp: string, bucketType: BucketSize): string => {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 0-indexed
      const day = date.getDate();

      if (bucketType === "year") {
        return `${year}`;
      } else if (bucketType === "month") {
        return `${year}-${String(month).padStart(2, "0")}`;
      } else if (bucketType === "week") {
        // Calculate ISO week number
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

    // Group faces by their re-calculated bucket
    const facesByBucket = new Map<string, number>();
    const allTimestamps: Date[] = [];

    acceptedFaces.forEach(face => {
      const key = getBucketKey(face.photo_timestamp, selectedBucket);
      facesByBucket.set(key, (facesByBucket.get(key) || 0) + 1);
      allTimestamps.push(new Date(face.photo_timestamp));
    });

    if (allTimestamps.length === 0) return [];

    // Sort timestamps to get actual first and last dates
    allTimestamps.sort((a, b) => a.getTime() - b.getTime());
    const firstTimestamp = allTimestamps[0];
    const lastTimestamp = allTimestamps[allTimestamps.length - 1];

    // Generate bucket keys for first and last dates
    const firstKey = getBucketKey(firstTimestamp.toISOString(), selectedBucket);
    const lastKey = getBucketKey(lastTimestamp.toISOString(), selectedBucket);

    const parseKey = (key: string) => {
      if (selectedBucket === "year") {
        return { year: parseInt(key), month: 1, day: 1 };
      } else if (selectedBucket === "month") {
        const [year, month] = key.split("-").map(Number);
        return { year, month, day: 1 };
      } else if (selectedBucket === "week") {
        const [year, week] = key.split("-W").map(Number);
        return { year, week, month: 0, day: 0 };
      } else if (selectedBucket === "day") {
        const [year, month, day] = key.split("-").map(Number);
        return { year, month, day };
      }
      return { year: 0, month: 1, day: 1 };
    };

    const first = parseKey(firstKey);
    const last = parseKey(lastKey);

    const allBucketsInRange: Array<{ key: string; label: string; hasFace: boolean; faceCount: number }> = [];

    if (selectedBucket === "year") {
      for (let year = first.year; year <= last.year; year++) {
        const key = `${year}`;
        allBucketsInRange.push({
          key,
          label: getBucketLabel(key, selectedBucket),
          hasFace: facesByBucket.has(key),
          faceCount: facesByBucket.get(key) || 0,
        });
      }
    } else if (selectedBucket === "month") {
      for (let year = first.year; year <= last.year; year++) {
        const startMonth = year === first.year ? first.month : 1;
        const endMonth = year === last.year ? last.month : 12;
        for (let month = startMonth; month <= endMonth; month++) {
          const key = `${year}-${String(month).padStart(2, "0")}`;
          allBucketsInRange.push({
            key,
            label: getBucketLabel(key, selectedBucket),
            hasFace: facesByBucket.has(key),
            faceCount: facesByBucket.get(key) || 0,
          });
        }
      }
    } else if (selectedBucket === "week") {
      // Generate all weeks in range - from first photo week to last photo week
      // Parse the first and last week keys to get actual dates
      const [firstYear, firstWeekStr] = firstKey.split("-W");
      const [lastYear, lastWeekStr] = lastKey.split("-W");
      const firstWeekNum = parseInt(firstWeekStr);
      const lastWeekNum = parseInt(lastWeekStr);

      // Generate all weeks between first and last
      let currentYear = parseInt(firstYear);
      let currentWeek = firstWeekNum;

      while (currentYear < parseInt(lastYear) || (currentYear === parseInt(lastYear) && currentWeek <= lastWeekNum)) {
        const key = `${currentYear}-W${String(currentWeek).padStart(2, "0")}`;

        allBucketsInRange.push({
          key,
          label: getBucketLabel(key, selectedBucket),
          hasFace: facesByBucket.has(key),
          faceCount: facesByBucket.get(key) || 0,
        });

        // Move to next week
        currentWeek++;
        if (currentWeek > 52) {
          currentWeek = 1;
          currentYear++;
        }
      }
    } else if (selectedBucket === "day") {
      // Generate all days in range
      const firstDate = new Date(first.year, first.month - 1, first.day);
      const lastDate = new Date(last.year, last.month - 1, last.day);

      let currentDate = new Date(firstDate);
      while (currentDate <= lastDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        allBucketsInRange.push({
          key,
          label: getBucketLabel(key, selectedBucket),
          hasFace: facesByBucket.has(key),
          faceCount: facesByBucket.get(key) || 0,
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return allBucketsInRange;
  }, [faces, selectedBucket]);

  // Calculate coverage and date range
  const getCoverageInfo = () => {
    if (selectedBucket === "all") {
      const acceptedCount = faces.filter(f => f.accepted).length;
      return {
        total: acceptedCount,
        covered: acceptedCount,
        missing: 0,
        duplicates: 0,
        missingBuckets: [],
        message: `All ${acceptedCount} selected face${acceptedCount !== 1 ? 's' : ''} will be included`,
        dateRange: null,
      };
    }

    const totalBuckets = bucketCoverage.length;
    const coveredBuckets = bucketCoverage.filter(b => b.hasFace).length;
    const missingBuckets = bucketCoverage.filter(b => !b.hasFace);
    const duplicateBuckets = bucketCoverage.filter(b => b.faceCount > 1).length;

    let message = "";
    if (missingBuckets.length === 0) {
      message = `Perfect coverage! All ${totalBuckets} ${selectedBucket}${totalBuckets !== 1 ? 's' : ''} have faces`;
    } else {
      const bucketLabels = missingBuckets.map(b => b.label).slice(0, 3);
      if (missingBuckets.length <= 3) {
        message = `Missing: ${bucketLabels.join(", ")}`;
      } else {
        message = `Missing: ${bucketLabels.join(", ")} and ${missingBuckets.length - 3} more`;
      }
    }

    // Get date range
    let dateRange = null;
    if (bucketCoverage.length > 0) {
      const firstLabel = bucketCoverage[0].label;
      const lastLabel = bucketCoverage[bucketCoverage.length - 1].label;
      dateRange = `${firstLabel} - ${lastLabel}`;
    }

    return {
      total: totalBuckets,
      covered: coveredBuckets,
      missing: missingBuckets.length,
      duplicates: duplicateBuckets,
      missingBuckets,
      message,
      dateRange,
    };
  };

  const coverage = getCoverageInfo();
  const coveragePercent = coverage.total > 0 ? (coverage.covered / coverage.total) * 100 : 0;

  const handleContinue = () => {
    // Store the selected bucket configuration
    // This will be used in the Arrange and Collage steps
    setSelectedBucketType(selectedBucket);
    setCurrentStep(4);
  };

  return (
    <section className="space-y-6">

      {!runId && (
        <p className="text-sm text-slate-400">Complete previous steps first.</p>
      )}

      {runId && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Time range selection */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col h-[550px]">
              <h2 className="text-lg font-semibold text-white mb-3">Time range</h2>
              <p className="text-sm text-slate-400 mb-6">
                Choose how to organize faces in your collage
              </p>

              <div className="space-y-3 flex-1">
                {BUCKET_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedBucket === option.value
                        ? "border-primary bg-primary/5"
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="bucket"
                      value={option.value}
                      checked={selectedBucket === option.value}
                      onChange={(e) => setSelectedBucket(e.target.value as BucketSize | "all")}
                      className="mt-0.5 w-4 h-4 text-primary accent-primary flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{option.label}</div>
                      <div className="text-xs text-slate-400">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Right: Coverage preview */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col h-[550px]">
              <div className="mb-3 flex-shrink-0">
                <h2 className="text-lg font-semibold text-white">Coverage preview</h2>
                {coverage.dateRange && (
                  <p className="text-xs text-slate-400 mt-1">{coverage.dateRange}</p>
                )}
              </div>

              {facesQuery.isLoading || bucketsQuery.isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-slate-400">Loading preview...</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Summary stats */}
                  <div className="flex items-center justify-between text-sm mb-3 flex-shrink-0">
                    <span className="text-slate-300">
                      {coverage.covered} of {coverage.total} slots filled
                    </span>
                    <span className={`font-semibold ${
                      coveragePercent === 100 ? "text-primary" : "text-yellow-500"
                    }`}>
                      {Math.round(coveragePercent)}%
                    </span>
                  </div>

                  {/* Grid preview - scrollable */}
                  <div className="flex-1 overflow-y-auto min-h-0 mb-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                      <div
                        className="grid gap-1"
                        style={{ gridTemplateColumns: `repeat(${PREVIEW_COLUMNS}, minmax(0, 1fr))` }}
                      >
                        {selectedBucket === "all" ? (
                          // Show all accepted faces
                          Array.from({ length: Math.min(coverage.total, PREVIEW_COLUMNS * MAX_PREVIEW_ROWS) }).map((_, i) => (
                            <div
                              key={i}
                              className="aspect-square rounded bg-primary/20 border border-primary/40"
                              title="Face included"
                            />
                          ))
                        ) : (
                          // Show bucket coverage
                          bucketCoverage.slice(0, PREVIEW_COLUMNS * MAX_PREVIEW_ROWS).map((bucket) => (
                            <div
                              key={bucket.key}
                              className={`aspect-square rounded border transition-all ${
                                bucket.hasFace
                                  ? "bg-primary/20 border-primary/40"
                                  : "bg-slate-800 border-slate-700"
                              }`}
                              title={bucket.hasFace ? `${bucket.label} - ${bucket.faceCount} face(s)` : `${bucket.label} - No faces`}
                            />
                          ))
                        )}
                      </div>
                      {coverage.total > PREVIEW_COLUMNS * MAX_PREVIEW_ROWS && (
                        <p className="text-xs text-slate-500 mt-2 text-center">
                          Showing first {PREVIEW_COLUMNS * MAX_PREVIEW_ROWS} of {coverage.total}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Legend and status */}
                  <div className="space-y-3 flex-shrink-0">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-primary/20 border border-primary/40" />
                        <span className="text-slate-400">Filled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
                        <span className="text-slate-400">Empty</span>
                      </div>
                    </div>

                    {/* Coverage message */}
                    {coverage.missing > 0 && (
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-xs text-yellow-500 font-semibold">
                          {coverage.missing} slot{coverage.missing !== 1 ? 's' : ''} empty
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {coverage.message}
                        </p>
                      </div>
                    )}

                    {coverage.duplicates > 0 && (
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-400 font-semibold">
                          {coverage.duplicates} slot{coverage.duplicates !== 1 ? 's' : ''} with multiple faces
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          The face can be selected per slot in the next step
                        </p>
                      </div>
                    )}

                    {coverage.missing === 0 && coverage.duplicates === 0 && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs text-primary font-semibold">
                          Perfect coverage!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between border-t border-slate-800 pt-6">
            <button
              onClick={() => setCurrentStep(2)}
              className="rounded border border-slate-700 bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Back to Select
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

export default Configure;
