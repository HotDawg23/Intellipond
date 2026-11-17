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
  if (!supabaseUrl || !serviceKey) return respond(500, "Account service is unavailable.");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond(401, "Sign in required.");
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return respond(401, "Sign in required.");

  const { data: role, error: roleError } = await admin.from("user_roles")
    .select("id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (roleError) return respond(500, "Could not check admin access.");
  if (!role) return respond(403, "Admin access required.");

  let body: unknown;
  try { body = await request.json(); } catch { return respond(400, "Invalid request."); }
  if (!body || typeof body !== "object") return respond(400, "Invalid request.");
  const input = body as Record<string, unknown>;
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const middleName = typeof input.middleName === "string" ? input.middleName.trim() : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = input.password;
  if (!firstName || !lastName || firstName.length > 120 || middleName.length > 120 || lastName.length > 120
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || typeof password !== "string" || password.length < 8) {
    return respond(400, "Enter first and last names, a valid email, and a password of at least 8 characters.");
  }

  const { data, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { first_name: firstName, middle_name: middleName || null, last_name: lastName },
  });
  if (createError) {
    if (createError.code === "email_exists" || /already (registered|exists)/i.test(createError.message)) {
      return respond(409, "An account with this email already exists.");
    }
    console.error("create-operator Auth error:", createError.message);
    return respond(400, createError.message);
  }
  if (!data.user) return respond(500, "Could not create the operator.");

  const { error: profileError } = await admin.from("profiles")
    .update({ first_name: firstName, middle_name: middleName || null, last_name: lastName,
      full_name: null, approved: true, must_change_password: true })
    .eq("id", data.user.id).select("id").single();
  if (profileError) {
    console.error("create-operator profile error:", profileError.message);
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
    if (cleanupError) console.error("create-operator cleanup error:", cleanupError.message);
    return respond(500, "Could not finish creating the operator.");
  }

  return respond(201);
});
