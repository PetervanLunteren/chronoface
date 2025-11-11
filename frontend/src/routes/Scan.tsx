import { useEffect, useState } from "react";
import { parse } from "exifr";

import { getBuckets, openEventStream, startScan } from "../api/client";
import type { ScanRequest, StatusResponse } from "../api/types";
import ProgressBar from "../components/ProgressBar";
import { useRunStore } from "../state/useRunStore";

interface FileWithMetadata {
  file: File;
  datetime: string | null;
  isDuplicate?: boolean;
}

function Scan() {
  const {
    runId,
    phase,
    progress,
    setRunId,
    updateStatus,
    setBuckets,
    setCurrentStep,
    pushToast
  } = useRunStore((state) => ({
    runId: state.runId,
    phase: state.phase,
    progress: state.progress,
    setRunId: state.setRunId,
    updateStatus: state.updateStatus,
    setBuckets: state.setBuckets,
    setCurrentStep: state.setCurrentStep,
    pushToast: state.pushToast
  }));

  const [folder, setFolder] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [accumulatedFiles, setAccumulatedFiles] = useState<FileWithMetadata[]>([]);
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (!runId) {
      return;
    }
    const source = openEventStream(runId, (event, data) => {
      if (!data) return;
      if (event === "phase" || event === "progress") {
        updateStatus(data as StatusResponse);
      }
      if (event === "error") {
        pushToast({ title: "Pipeline error", description: String((data as Record<string, unknown>)?.error ?? "") });
      }
    });
    return () => source.close();
  }, [runId, updateStatus, pushToast]);

  useEffect(() => {
    if (runId && phase === "done") {
      // Load faces count and buckets when scan completes, then auto-advance
      import("../api/client").then(({ getAllFaces, getBuckets }) => {
        getAllFaces(runId).then((response) => {
          const totalFaces = response.faces.length;
          pushToast({
            title: `Scan complete - ${totalFaces} ${totalFaces === 1 ? "face" : "faces"} detected`,
            description: "Advancing to review..."
          });
          // Auto-advance to review step
          setTimeout(() => setCurrentStep(2), 1000);
        }).catch(() => {
          pushToast({ title: "Failed to load faces", variant: "error" });
        });
        getBuckets(runId).then(setBuckets).catch(() => {
          pushToast({ title: "Failed to load buckets", variant: "error" });
        });
      });
    }
  }, [runId, phase, setBuckets, setCurrentStep, pushToast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);

    // Filter to only image files
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.heic'];
    const imageFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return imageExtensions.includes(ext);
    });

    if (imageFiles.length === 0) {
      pushToast({ title: "Please drop image files", description: "Supported: JPG, PNG, HEIC", variant: "error" });
      return;
    }

    // Read EXIF data for each file
    const filesWithMetadata: FileWithMetadata[] = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const exif = await parse(file, { pick: ['DateTimeOriginal'] });
          const datetime = exif?.DateTimeOriginal ? new Date(exif.DateTimeOriginal).toLocaleString() : null;
          return { file, datetime, isDuplicate: false };
        } catch (error) {
          return { file, datetime: null, isDuplicate: false };
        }
      })
    );

    // Check for duplicates based on datetime
    setAccumulatedFiles(prev => {
      const allFiles = [...prev, ...filesWithMetadata];
      const seenTimestamps = new Set<string>();

      // Mark duplicates
      return allFiles.map(item => {
        if (item.datetime) {
          if (seenTimestamps.has(item.datetime)) {
            return { ...item, isDuplicate: true };
          }
          seenTimestamps.add(item.datetime);
        }
        return { ...item, isDuplicate: false };
      });
    });
    pushToast({
      title: `Added ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}`,
      description: `Total: ${accumulatedFiles.length + imageFiles.length} images ready`
    });
  };

  const handleStartScan = async () => {
    if (accumulatedFiles.length === 0) {
      pushToast({ title: "No images to scan", variant: "error" });
      return;
    }

    // Filter out files with missing datetime or duplicates
    const validFiles = accumulatedFiles.filter(item => item.datetime && !item.isDuplicate);
    const skippedCount = accumulatedFiles.length - validFiles.length;

    if (validFiles.length === 0) {
      pushToast({ title: "No valid images to scan", description: "All images are missing dates or duplicates", variant: "error" });
      return;
    }

    // Upload files and start scan
    setIsStarting(true);
    try {
      const formData = new FormData();
      validFiles.forEach(item => {
        formData.append('files', item.file);
      });

      console.log(`Uploading ${validFiles.length} files to /api/upload-scan...`);
      console.log(`Total upload size: ${Array.from(formData.values()).reduce((sum, file) => sum + (file as File).size, 0)} bytes`);

      // Add timeout to prevent hanging forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('Upload timeout after 120 seconds');
        controller.abort();
      }, 120000); // 120 second timeout

      console.log('Sending fetch request...');
      const response = await fetch('/api/upload-scan', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('Fetch completed');

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Upload response data:', data);

      // Show validation results (backend skipped + frontend skipped)
      const totalSkipped = (data.skipped?.length || 0) + skippedCount;
      if (totalSkipped > 0) {
        let description = '';
        if (skippedCount > 0) {
          description += `${skippedCount} skipped (duplicates/missing dates)\n`;
        }
        if (data.skipped && data.skipped.length > 0) {
          const formatReason = (reason: string) => {
            switch (reason) {
              case 'no_exif':
                return 'missing EXIF data';
              case 'no_datetime':
                return 'missing photo date';
              default:
                return reason;
            }
          };
          description += data.skipped.map((s: any) => `${s.filename}: ${formatReason(s.reason)}`).join('\n');
        }
        pushToast({
          title: `${data.valid_count} valid, ${totalSkipped} skipped`,
          description: description.trim(),
          variant: "default"
        });
      }

      if (data.valid_count > 0) {
        setRunId(data.run_id);
        setScanStartTime(Date.now());
        pushToast({
          title: `Processing ${data.valid_count} image${data.valid_count > 1 ? 's' : ''}`,
          description: "Detecting faces..."
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        pushToast({ title: "Upload timed out", description: "The upload took too long and was cancelled. Please try again.", variant: "error" });
      } else {
        pushToast({ title: "Failed to upload images", description: String(error), variant: "error" });
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <section className="space-y-8">
      {!runId && !isStarting && (
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Drag and drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed bg-slate-900/60 p-12 flex items-center justify-center transition-all h-[450px] ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-slate-700 hover:border-primary/50"
              }`}
            >
              <div className="text-center space-y-6">
                <div className={`mx-auto flex h-32 w-32 items-center justify-center rounded-full transition-all ${
                  isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"
                }`}>
                  <svg className={`h-16 w-16 transition-all ${isDragging ? "text-primary scale-110" : "text-primary"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>

                <div>
                  <p className={`text-2xl font-bold mb-2 transition-colors ${isDragging ? "text-primary" : "text-white"}`}>
                    {isDragging ? "Drop images here" : "Drag & drop images"}
                  </p>
                  <p className="text-slate-400 text-base">
                    JPG, PNG, HEIC supported
                  </p>
                </div>
              </div>
            </div>

            {/* Right: File list and button */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col h-[450px]">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-white">
                  {accumulatedFiles.length > 0 && `${accumulatedFiles.length} image${accumulatedFiles.length > 1 ? 's' : ''} ready`}
                </h3>
                {accumulatedFiles.length > 0 && (
                  <button
                    onClick={() => setAccumulatedFiles([])}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {accumulatedFiles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-center">
                  <p>Drop images on the left to begin</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto mb-4 space-y-1 min-h-0">
                    {accumulatedFiles.map((item, index) => (
                      <div key={index} className="flex flex-col gap-1 text-sm bg-slate-800/50 rounded px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 truncate">{item.file.name}</span>
                          <span className="text-slate-500 text-xs ml-2">{(item.file.size / 1024).toFixed(1)} KB</span>
                        </div>
                        {!item.datetime ? (
                          <span className="text-yellow-500 text-xs font-semibold">WARNING: Missing photo date - will be skipped</span>
                        ) : item.isDuplicate ? (
                          <span className="text-yellow-500 text-xs font-semibold">WARNING: Duplicate timestamp ({item.datetime}) - will be skipped</span>
                        ) : (
                          <span className="text-slate-500 text-xs">{item.datetime}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleStartScan}
                    className="w-full rounded bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90 transition-colors flex-shrink-0"
                  >
                    Start Scan →
                  </button>
                </>
              )}
            </div>
          </div>
      )}

      {isStarting && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4 animate-pulse">
            <svg className="h-10 w-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-xl font-semibold text-white">Uploading images...</p>
          <p className="text-slate-400 text-sm mt-2">Please wait</p>
          <button
            onClick={() => {
              setIsStarting(false);
              pushToast({ title: "Upload cancelled", description: "You can try again when ready" });
            }}
            className="mt-6 rounded border border-slate-700 bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {runId && phase !== "idle" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 space-y-6">
          {/* Step 1: Scanning photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-white">
                Scanning photos
              </h3>
              {phase === "scanning" && (
                <span className="text-xs text-primary">In progress...</span>
              )}
              {(phase === "detecting" || phase === "embedding" || phase === "clustering" || phase === "done") && (
                <span className="text-xs text-slate-400">Complete</span>
              )}
            </div>
            {(phase === "scanning" || phase === "detecting" || phase === "embedding" || phase === "clustering" || phase === "done") && (
              <ProgressBar
                processed={phase === "scanning" ? progress.processed : progress.total}
                total={progress.total}
                startTime={phase === "scanning" ? (scanStartTime || undefined) : undefined}
              />
            )}
          </div>

          {/* Step 2: Detecting faces */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-white">
                Detecting faces
              </h3>
              {phase === "detecting" && (
                <span className="text-xs text-primary">In progress...</span>
              )}
              {(phase === "embedding" || phase === "clustering" || phase === "done") && (
                <span className="text-xs text-slate-400">Complete</span>
              )}
              {phase === "scanning" && (
                <span className="text-xs text-slate-500">Waiting...</span>
              )}
            </div>
            {(phase === "detecting" || phase === "embedding" || phase === "clustering" || phase === "done") && (
              <ProgressBar
                processed={phase === "detecting" ? progress.processed : progress.total}
                total={progress.total}
                startTime={phase === "detecting" ? (scanStartTime || undefined) : undefined}
              />
            )}
            {phase === "scanning" && (
              <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
                <div className="h-full rounded bg-slate-700" style={{ width: '0%' }} />
              </div>
            )}
          </div>

          {phase === "done" && (
            <p className="text-center text-sm text-slate-400">Complete - Advancing to review...</p>
          )}
        </div>
      )}
    </section>
  );
}

export default Scan;
