import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createCollage, getAllFaces } from "../api/client";
import type { CollageRequest } from "../api/types";
import { useRunStore } from "../state/useRunStore";

function Collage() {
  const {
    runId,
    setCurrentStep,
    pushToast
  } = useRunStore((state) => ({
    runId: state.runId,
    setCurrentStep: state.setCurrentStep,
    pushToast: state.pushToast
  }));

  const outputFormat = "A4"; // Fixed for now, will be configurable later
  const [roundedCorners, setRoundedCorners] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get the face selections from Arrange step (or fall back to Review step selections)
  const { selectedFaceIds, bucketFaceSelections } = useRunStore((state) => ({
    selectedFaceIds: state.selectedFaceIds,
    bucketFaceSelections: state.bucketFaceSelections
  }));

  // Use faces selected in Arrange step if available, otherwise use all selected faces from Review
  // Memoize to prevent unnecessary re-renders
  const facesToUse = useMemo(() => {
    return Object.keys(bucketFaceSelections).length > 0
      ? Object.values(bucketFaceSelections)
      : selectedFaceIds;
  }, [bucketFaceSelections, selectedFaceIds]);

  const numAcceptedFaces = facesToUse.length;

  // Calculate optimal layout based on number of faces (same layout for all paper sizes)
  const { columns, tileSize, paddingX, paddingY, margin } = useMemo(() => {
    const numFaces = numAcceptedFaces;
    if (numFaces === 0) return { columns: 12, tileSize: 160, paddingX: 4, paddingY: 4, margin: 32 };

    const paperDimensions: Record<string, [number, number]> = {
      A5: [1748, 2480],
      A4: [2480, 3508],
      A3: [3508, 4961],
    };

    const [paperWidth, paperHeight] = paperDimensions[outputFormat];

    // Step 1: Find optimal column count and calculate tile size + padding together
    // We'll use margin = padding, so we need to account for that in available space
    let bestLayout = { columns: 3, tileSize: 0, paddingX: 0, paddingY: 0, margin: 32 };

    const maxCols = Math.min(12, numFaces);
    for (let cols = 3; cols <= maxCols; cols++) {
      const rows = Math.ceil(numFaces / cols);

      // We want margin to equal padding, so:
      // paperWidth = margin*2 + cols*tile + (cols-1)*padX
      // Since margin = padX, we get:
      // paperWidth = padX*2 + cols*tile + (cols-1)*padX = cols*tile + (cols+1)*padX
      // So: tile = (paperWidth - (cols+1)*padX) / cols

      // Let's assume padding is about 10% of tile size to start
      // paperWidth ≈ cols*tile + (cols+1)*0.1*tile = tile*(cols + 0.1*cols + 0.1)
      const tileFromWidth = Math.floor(paperWidth / (cols * 1.1 + 0.1));

      // For height, we need to account for label space below each tile
      // Estimate label height as about 8% of tile size
      // paperHeight ≈ rows*(tile + labelHeight) + (rows+1)*0.1*tile
      // paperHeight ≈ rows*tile*1.08 + rows*0.1*tile + 0.1*tile = tile*(rows*1.18 + 0.1)
      const tileFromHeight = Math.floor(paperHeight / (rows * 1.18 + 0.1));

      const tileSize = Math.min(tileFromWidth, tileFromHeight);

      // Now calculate padding and margin to fill the space
      // paperWidth = margin*2 + cols*tile + (cols-1)*padX, where margin = padX
      // paperWidth = 2*padX + cols*tile + (cols-1)*padX = cols*tile + (cols+1)*padX
      const remainingWidth = paperWidth - (cols * tileSize);
      const paddingX = cols > 1 ? Math.floor(remainingWidth / (cols + 1)) : Math.floor(remainingWidth / 3);

      const remainingHeight = paperHeight - (rows * tileSize);
      const paddingY = rows > 1 ? Math.floor(remainingHeight / (rows + 1)) : Math.floor(remainingHeight / 3);

      // Use the smaller padding as the margin to keep it consistent
      const margin = Math.min(paddingX, paddingY);

      console.log(`Testing cols=${cols}, rows=${rows}:`, {
        tileFromWidth,
        tileFromHeight,
        tileSize,
        paddingX,
        paddingY,
        margin
      });

      if (tileSize > bestLayout.tileSize && tileSize >= 150) {
        bestLayout = { columns: cols, tileSize, paddingX, paddingY, margin };
      }
    }

    const finalColumns = bestLayout.columns;
    const finalRows = Math.ceil(numFaces / finalColumns);
    const finalTileSize = bestLayout.tileSize;
    const horizontalPadding = bestLayout.paddingX;
    const verticalPadding = bestLayout.paddingY;
    const finalMargin = bestLayout.margin;

    console.log('Final layout:', {
      numFaces,
      columns: finalColumns,
      rows: finalRows,
      tileSize: finalTileSize,
      paddingX: horizontalPadding,
      paddingY: verticalPadding,
      margin: finalMargin,
      paperWidth,
      paperHeight
    });

    return {
      columns: finalColumns,
      tileSize: finalTileSize,
      paddingX: horizontalPadding,
      paddingY: verticalPadding,
      margin: finalMargin,
    };
  }, [numAcceptedFaces, outputFormat]);

  // Use "all" to include all faces, not filtered by bucket
  const bucket = "all";

  const request = useMemo((): CollageRequest | null => {
    if (!runId) return null;

    // Calculate corner radius as 10% of tile size if enabled, otherwise 0
    const cornerRadius = roundedCorners ? Math.round(tileSize * 0.1) : 0;

    return {
      run_id: runId,
      bucket: bucket,
      tile_size: tileSize,
      columns,
      padding_x: paddingX,
      padding_y: paddingY,
      margin: margin,
      background: "#ffffff", // white
      sort: "by_time",
      max_faces: 365,
      face_selection: "accepted_only",
      face_ids: facesToUse.length > 0 ? facesToUse : undefined, // Pass specific face IDs if available
      corner_radius: cornerRadius,
      show_labels: showLabels,
      output_format: outputFormat
    };
  }, [runId, bucket, tileSize, columns, paddingX, paddingY, margin, roundedCorners, showLabels, outputFormat, facesToUse]);

  // Auto-generate preview when settings change - DISABLED for performance
  // useEffect(() => {
  //   if (!request) return;

  //   const timer = setTimeout(() => {
  //     setIsGenerating(true);
  //     createCollage(request)
  //       .then((result) => {
  //         setPreviewUrl(result.static_url ?? null);
  //         setDimensions({ width: result.width, height: result.height });
  //       })
  //       .catch(() => pushToast({ title: "Preview failed", variant: "error" }))
  //       .finally(() => setIsGenerating(false));
  //   }, 500);

  //   return () => clearTimeout(timer);
  // }, [request]);

  const handleGenerate = async () => {
    if (!request) return;

    setIsGenerating(true);
    try {
      const result = await createCollage(request);
      setPreviewUrl(result.static_url ?? null);
      setDimensions({ width: result.width, height: result.height });
      pushToast({
        title: "Collage generated!",
        description: `Saved to ${result.output_path}`
      });
    } catch (error) {
      pushToast({ title: "Generation failed", description: String(error), variant: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="space-y-6">
      {!runId && (
        <p className="text-sm text-slate-400">Complete previous steps first.</p>
      )}

      {runId && numAcceptedFaces > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Settings */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col h-[550px]">
              <h2 className="text-lg font-semibold text-white mb-3">Collage settings</h2>

              <div className="space-y-6 flex-1">

                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">Rounded corners</label>
                  <button
                    onClick={() => setRoundedCorners(!roundedCorners)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      roundedCorners ? "bg-primary" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        roundedCorners ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">Show date labels</label>
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showLabels ? "bg-primary" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showLabels ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={async () => {
                    if (!request) return;
                    setIsGenerating(true);
                    try {
                      const result = await createCollage(request);
                      setPreviewUrl(result.static_url ?? null);
                      setDimensions({ width: result.width, height: result.height });
                    } catch {
                      pushToast({ title: "Preview failed", variant: "error" });
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={isGenerating || !request}
                  className="w-full rounded border border-primary px-6 py-2 font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate Preview
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !request}
                  className="w-full rounded bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? "Generating..." : "Generate Collage"}
                </button>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col h-[550px]">
              <h2 className="text-lg font-semibold text-white mb-3">Preview</h2>

              <div className="flex-1 flex items-center justify-center bg-slate-900 rounded-lg border border-slate-700 overflow-auto p-4">
                {isGenerating && (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-slate-400">Generating preview...</p>
                  </div>
                )}
                {!isGenerating && previewUrl && dimensions && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Paper outline - calculate size based on aspect ratio */}
                    <div
                      className="absolute bg-white pointer-events-none"
                      style={{
                        width: dimensions.width > dimensions.height
                          ? '100%'
                          : `${(dimensions.width / dimensions.height) * 100}%`,
                        height: dimensions.height > dimensions.width
                          ? '100%'
                          : `${(dimensions.height / dimensions.width) * 100}%`,
                        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
                      }}
                    />
                    {/* Image */}
                    <img
                      src={previewUrl}
                      alt="Collage preview"
                      className="relative z-10 max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                {!isGenerating && !previewUrl && (
                  <p className="text-sm text-slate-400">
                    Adjust settings to see preview
                  </p>
                )}
              </div>
              {dimensions && (
                <p className="mt-3 text-xs text-slate-500 text-center">
                  {dimensions.width} × {dimensions.height}px
                </p>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between border-t border-slate-800 pt-6">
            <button
              onClick={() => setCurrentStep(4)}
              className="rounded border border-slate-700 bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Back to Arrange
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Collage;
