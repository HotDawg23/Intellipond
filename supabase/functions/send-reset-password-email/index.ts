import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const FROM_EMAIL = "karlopasaoa@gmail.com";
const FROM_NAME = "IntelliPond";
const ALLOWED_REDIRECT_ORIGINS = new Set([
  "https://intellipond.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);

const corsHeadersFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_REDIRECT_ORIGINS.has(origin) ? origin : "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const getAllowedRedirect = (redirectTo: unknown): string | null => {
  if (typeof redirectTo !== "string") return null;

  try {
    const url = new URL(redirectTo);
    if (
      !ALLOWED_REDIRECT_ORIGINS.has(url.origin) ||
      url.pathname !== "/reset-password" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return `${url.origin}/reset-password`;
  } catch {
    return null;
  }
};

const createHmacDigester = async (secret: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return async (value: string) => {
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
    return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = corsHeadersFor(origin);

  if (origin && !ALLOWED_REDIRECT_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: "origin not allowed" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, redirectTo: requestedRedirect } = await req.json();
    if (typeof email !== "string" || !email.trim()) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectTo = getAllowedRedirect(requestedRedirect);
    if (!redirectTo) {
      return new Response(JSON.stringify({ error: "invalid redirect URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase function credentials are not configured");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const digest = await createHmacDigester(serviceRoleKey);
    const emailDigest = await digest(`email:${email.trim().toLowerCase()}`);
    // Supabase's hosted edge proxy supplies this header. Avoid falling back to
    // X-Forwarded-For, which a direct caller could forge.
    const forwardedClientIp = req.headers.get("cf-connecting-ip")?.trim();
    const supabaseHostname = new URL(supabaseUrl).hostname;
    const isLocalSupabase = ["localhost", "127.0.0.1", "::1", "[::1]", "kong"].includes(supabaseHostname);
    const clientIp = forwardedClientIp || (isLocalSupabase ? "local-development" : null);
    if (!clientIp) {
      console.error("password reset rate limit could not identify the client IP");
      return new Response(JSON.stringify({ error: "Could not process the reset request." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ipDigest = await digest(`ip:${clientIp}`);

    const { data: rateLimitRows, error: rateLimitError } = await admin.rpc(
      "consume_password_reset_rate_limit",
      { p_email_digest: emailDigest, p_ip_digest: ipDigest },
    );

    if (rateLimitError) {
      console.error("password reset rate limit failed:", rateLimitError.message);
      return new Response(JSON.stringify({ error: "Could not process the reset request." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimit = Array.isArray(rateLimitRows) ? rateLimitRows[0] : undefined;
    if (!rateLimit || typeof rateLimit.allowed !== "boolean") {
      console.error("password reset rate limit returned an invalid result");
      return new Response(JSON.stringify({ error: "Could not process the reset request." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Number(rateLimit.retry_after_seconds) || 1);
      return new Response(JSON.stringify({ error: "Too many reset requests. Please wait before trying again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfterSeconds) },
      });
    }

    // Generate a recovery link via admin API (does NOT send any email)
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim(),
      options: { redirectTo },
    });

    if (error) {
      console.error("generateLink error:", error);
      // Don't leak existence — return success
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appPassword = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!appPassword) throw new Error("GMAIL_APP_PASSWORD not configured");

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: FROM_EMAIL, password: appPassword.replace(/\s+/g, "") },
      },
    });

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Reset your IntelliPond password</h1>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
        We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in 1 hour.
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${actionLink}" style="background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Reset password</a>
      </p>
      <p style="margin:0 0 8px;color:#64748b;font-size:12px;">Or copy and paste this URL into your browser:</p>
      <p style="margin:0 0 24px;word-break:break-all;font-size:12px;color:#0ea5e9;">${actionLink}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="margin:0;color:#94a3b8;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">IntelliPond · Capstone research platform</p>
  </div>
</body></html>`;

    await client.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: "Reset your IntelliPond password",
      content: `Reset your password: ${actionLink}`,
      html,
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-reset-password-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
