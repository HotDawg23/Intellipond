import { describe, expect, it } from "vitest";
import { readAuthRecoveryCallbackState } from "./auth-recovery-callback";

describe("readAuthRecoveryCallbackState", () => {
  it("recognizes a recovery callback in the URL fragment", () => {
    expect(readAuthRecoveryCallbackState(
      "https://intellipond.vercel.app/#access_token=token&type=recovery",
    )).toEqual({ isRecovery: true, isExpired: false });
  });

  it("recognizes a recovery callback in the query string", () => {
    expect(readAuthRecoveryCallbackState(
      "http://localhost:8080/reset-password?type=recovery",
    )).toEqual({ isRecovery: true, isExpired: false });
  });

  it("recognizes an expired recovery link", () => {
    expect(readAuthRecoveryCallbackState(
      "https://intellipond.vercel.app/#error=access_denied&error_code=otp_expired",
    )).toEqual({ isRecovery: false, isExpired: true });
  });

  it("ignores ordinary URLs", () => {
    expect(readAuthRecoveryCallbackState("https://intellipond.vercel.app/#")).toEqual({
      isRecovery: false,
      isExpired: false,
    });
  });
});
