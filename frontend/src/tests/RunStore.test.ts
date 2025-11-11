import { afterEach, describe, expect, it } from "vitest";

import type { StatusResponse } from "../api/types";
import { useRunStore } from "../state/useRunStore";

afterEach(() => {
  useRunStore.getState().reset();
});

describe("run store", () => {
  it("updates status", () => {
    const { updateStatus } = useRunStore.getState();
    const status: StatusResponse = {
      run_id: "abc",
      phase: "scanning",
      processed: 5,
      total: 10,
      message: "Scanning"
    };
    updateStatus(status);
    const state = useRunStore.getState();
    expect(state.phase).toBe("scanning");
    expect(state.progress.processed).toBe(5);
  });
});
