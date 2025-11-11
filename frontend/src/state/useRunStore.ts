import { create } from "zustand";
import type {
  BucketSummary,
  FaceItem,
  Phase,
  StatusResponse
} from "../api/types";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

export interface RunState {
  runId: string | null;
  phase: Phase;
  progress: { processed: number; total: number; message?: string };
  currentStep: number;
  buckets: BucketSummary[];
  currentBucket: string | null;
  facesByBucket: Record<string, FaceItem[]>;
  skipped: { path: string; reason: string }[];
  selectedFaceIds: string[];
  selectedBucketType: "day" | "week" | "month" | "year" | "all" | null;
  bucketFaceSelections: Record<string, string>;
  toasts: ToastMessage[];
  setRunId: (runId: string | null) => void;
  updateStatus: (status: StatusResponse) => void;
  setCurrentStep: (step: number) => void;
  setBuckets: (buckets: BucketSummary[]) => void;
  setCurrentBucket: (bucket: string | null) => void;
  setFaces: (bucket: string, faces: FaceItem[]) => void;
  setSkipped: (skipped: { path: string; reason: string }[]) => void;
  setSelectedFaceIds: (ids: string[]) => void;
  setSelectedBucketType: (type: "day" | "week" | "month" | "year" | "all") => void;
  setBucketFaceSelections: (selections: Record<string, string>) => void;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  popToast: () => void;
  reset: () => void;
}

export const useRunStore = create<RunState>((set, get) => ({
  runId: null,
  phase: "idle",
  progress: { processed: 0, total: 0 },
  currentStep: 1,
  buckets: [],
  currentBucket: null,
  facesByBucket: {},
  skipped: [],
  selectedFaceIds: [],
  selectedBucketType: null,
  bucketFaceSelections: {},
  toasts: [],
  setRunId: (runId) => set({ runId }),
  updateStatus: (status) =>
    set({
      phase: status.phase,
      progress: {
        processed: status.processed,
        total: status.total,
        message: status.message
      }
    }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setBuckets: (buckets) =>
    set({
      buckets,
      currentBucket: buckets.length ? buckets[0].key : null
    }),
  setCurrentBucket: (bucket) => set({ currentBucket: bucket }),
  setFaces: (bucket, faces) =>
    set((state) => ({
      facesByBucket: { ...state.facesByBucket, [bucket]: faces }
    })),
  setSkipped: (skipped) => set({ skipped }),
  setSelectedFaceIds: (ids) => set({ selectedFaceIds: ids }),
  setSelectedBucketType: (type) => set({ selectedBucketType: type }),
  setBucketFaceSelections: (selections) => set({ bucketFaceSelections: selections }),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: crypto.randomUUID(), variant: "default", ...toast }
      ]
    })),
  popToast: () =>
    set((state) => ({ toasts: state.toasts.slice(1) })),
  reset: () =>
    set({
      runId: null,
      phase: "idle",
      progress: { processed: 0, total: 0 },
      currentStep: 1,
      buckets: [],
      currentBucket: null,
      facesByBucket: {},
      skipped: [],
      selectedFaceIds: [],
      selectedBucketType: null,
      bucketFaceSelections: {},
      toasts: []
    })
}));
