export type Phase = "idle" | "scanning" | "detecting" | "embedding" | "clustering" | "done" | "error";

export type BucketSize = "day" | "week" | "month" | "year";

export interface ScanRequest {
  folder: string;
  bucket: BucketSize;
  max_edge: number;
  min_face_px: number;
  thumb_edge: number;
  downscale_detector: boolean;
}

export interface SkippedFile {
  filename: string;
  reason: string;
}

export interface ScanResponse {
  run_id: string;
  status: "started";
  valid_count: number;
  skipped: SkippedFile[];
}

export interface StatusResponse {
  run_id: string;
  phase: Phase;
  processed: number;
  total: number;
  message?: string;
}

export interface BucketSummary {
  key: string;
  label: string;
  photo_count: number;
  face_count: number;
}

export interface ClusterSummary {
  cluster_id: string;
  face_count: number;
  label: string;
}

export interface FaceItem {
  face_id: string;
  photo_id: string;
  bucket: string;
  bbox: [number, number, number, number];
  score: number;
  size_px: number;
  embedding_id: string;
  cluster_id: string;
  accepted: boolean | null;
  thumb_url: string;
  photo_path: string;
  photo_timestamp: string;
}

export interface FacesResponse {
  faces: FaceItem[];
  skipped_photos: { path: string; reason: string }[];
}

export interface ReviewRequest {
  run_id: string;
  accept: string[];
  reject: string[];
  accept_clusters: string[];
  reject_clusters: string[];
  merge_clusters: { clusters: string[] }[];
  split_clusters: { cluster_id: string; face_ids: string[] }[];
}

export interface ReviewResponse {
  run_id: string;
  updated_faces: FaceItem[];
}

export interface CollageRequest {
  run_id: string;
  bucket: string;
  tile_size: number;
  columns: number;
  padding_x: number;
  padding_y: number;
  margin: number;
  background: string;
  sort: "by_time" | "by_cluster" | "random";
  max_faces: number;
  face_selection: "accepted_only" | "accepted_and_unreviewed";
  face_ids?: string[]; // Optional: specific face IDs to include
  corner_radius?: number;
  show_labels?: boolean;
  title?: string; // Optional: title text to display at top
  label_format?: "day" | "week" | "month" | "year" | "all"; // Format for date labels
  output_format?: "A5" | "A4" | "A3";
  preview?: boolean; // If true, use low-quality thumbnails for faster preview
}

export interface CollageResponse {
  output_path: string;
  width: number;
  height: number;
  static_url?: string | null;
}
