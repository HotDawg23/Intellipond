import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const allowedOrigins = new Set([
  "https://intellipond.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const respond = (status: number, error?: string) =>
    new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers });

  if (origin && !allowedOrigins.has(origin)) return respond(403, "Origin not allowed.");
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return respond(405, "Method not allowed.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return respond(500, "Password service is unavailable.");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond(401, "Sign in required.");
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return respond(401, "Sign in required.");

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("must_change_password").eq("id", user.id).maybeSingle();
  if (profileError) return respond(500, "Could not check account status.");
  if (!profile?.must_change_password) return respond(409, "No initial password change is required.");

  let body: unknown;
  try { body = await request.json(); } catch { return respond(400, "Invalid request."); }
  const password = body && typeof body === "object" ? (body as Record<string, unknown>).password : null;
  if (typeof password !== "string" || password.length < 8) {
    return respond(400, "Password must be at least 8 characters.");
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password });
  if (passwordError) return respond(400, passwordError.message);
  const { error: updateError } = await admin.from("profiles")
    .update({ must_change_password: false }).eq("id", user.id).select("id").single();
  if (updateError) {
    console.error("change-initial-password profile error:", updateError.message);
    return respond(500, "Password changed, but account setup could not finish. Please try again.");
  }
  return respond(200);
});
