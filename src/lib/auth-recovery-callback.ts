export type AuthRecoveryCallbackState = {
  isRecovery: boolean;
  isExpired: boolean;
};

export const readAuthRecoveryCallbackState = (href: string): AuthRecoveryCallbackState => {
  try {
    const url = new URL(href);
    const params = [
      new URLSearchParams(url.search),
      new URLSearchParams(url.hash.replace(/^#/, "")),
    ];

    return {
      isRecovery: params.some(value => value.get("type") === "recovery"),
      isExpired: params.some(value => value.get("error_code") === "otp_expired"),
    };
  } catch {
    return { isRecovery: false, isExpired: false };
  }
};

// Capture the callback before Supabase Auth consumes and clears URL tokens.
export const initialAuthRecoveryCallback = typeof window === "undefined"
  ? { isRecovery: false, isExpired: false }
  : readAuthRecoveryCallbackState(window.location.href);
