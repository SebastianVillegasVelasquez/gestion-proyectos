import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { refreshAccessToken, SESSION_REFRESHED_EVENT } from "./refresh";

vi.mock("axios");

const response = {
  data: {
    access_token: "new-access",
    refresh_token: "new-refresh",
    token_type: "bearer",
    user: { id: "u1", name: "Test", email: "t@test.com", role: "admin" },
  },
};

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns null when there is no refresh token stored", async () => {
    expect(await refreshAccessToken()).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("stores the new tokens and emits a refresh event on success", async () => {
    localStorage.setItem("refresh_token", "old-refresh");
    vi.mocked(axios.post).mockResolvedValue(response);
    const listener = vi.fn();
    window.addEventListener(SESSION_REFRESHED_EVENT, listener);

    const token = await refreshAccessToken();

    expect(token).toBe("new-access");
    expect(localStorage.getItem("access_token")).toBe("new-access");
    expect(localStorage.getItem("refresh_token")).toBe("new-refresh");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_REFRESHED_EVENT, listener);
  });

  it("clears the session and returns null when refresh fails", async () => {
    localStorage.setItem("refresh_token", "old-refresh");
    localStorage.setItem("access_token", "stale");
    vi.mocked(axios.post).mockRejectedValue(new Error("401"));

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("shares a single in-flight request across concurrent callers", async () => {
    localStorage.setItem("refresh_token", "old-refresh");
    vi.mocked(axios.post).mockResolvedValue(response);

    const [a, b, c] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect([a, b, c]).toEqual(["new-access", "new-access", "new-access"]);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});
