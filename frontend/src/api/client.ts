import type {
  BucketSummary,
  ClusterSummary,
  CollageRequest,
  CollageResponse,
  FacesResponse,
  ReviewRequest,
  ReviewResponse,
  ScanRequest,
  ScanResponse,
  StatusResponse
} from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  return (await response.json()) as T;
}

export async function startScan(payload: ScanRequest): Promise<ScanResponse> {
  return fetchJson<ScanResponse>("/api/scan", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
}

export async function getStatus(runId: string): Promise<StatusResponse> {
  return fetchJson<StatusResponse>(`/api/status?run_id=${encodeURIComponent(runId)}`);
}

export async function getClusters(runId: string): Promise<ClusterSummary[]> {
  return fetchJson(`/api/clusters?run_id=${encodeURIComponent(runId)}`);
}

export async function getBuckets(runId: string): Promise<BucketSummary[]> {
  return fetchJson(`/api/buckets?run_id=${encodeURIComponent(runId)}`);
}

export async function getClusterFaces(runId: string, clusterId: string): Promise<FacesResponse> {
  const params = new URLSearchParams({ run_id: runId, cluster_id: clusterId });
  return fetchJson(`/api/cluster-faces?${params.toString()}`);
}

export async function getAllFaces(runId: string): Promise<FacesResponse> {
  const params = new URLSearchParams({ run_id: runId });
  return fetchJson(`/api/all-faces?${params.toString()}`);
}

export async function getFaces(runId: string, bucket: string): Promise<FacesResponse> {
  const params = new URLSearchParams({ run_id: runId, bucket });
  return fetchJson(`/api/faces?${params.toString()}`);
}

export async function submitReview(payload: ReviewRequest): Promise<ReviewResponse> {
  return fetchJson<ReviewResponse>("/api/review", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
}

export async function createCollage(payload: CollageRequest): Promise<CollageResponse> {
  return fetchJson<CollageResponse>("/api/collage", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
}

export type StreamHandler = (event: string, data: unknown) => void;

export function openEventStream(runId: string, handler: StreamHandler): EventSource {
  const url = `/api/stream?run_id=${encodeURIComponent(runId)}`;
  const source = new EventSource(url);
  const events = ["phase", "progress", "warning", "done", "error"];
  events.forEach((event) => {
    source.addEventListener(event, (ev) => {
      try {
        handler(event, JSON.parse((ev as MessageEvent<string>).data));
      } catch (error) {
        handler(event, null);
      }
    });
  });
  return source;
}
