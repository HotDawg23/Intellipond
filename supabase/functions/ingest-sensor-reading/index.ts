import { createClient } from "npm:@supabase/supabase-js@2.117.1";

const BFAR_POND_ID = "2550ee49-911e-4b82-bf53-7f5eecc8939b";
const MAX_BODY_BYTES = 8 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

function constantTimeEquals(leftValue: string, rightValue: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(leftValue);
  const right = encoder.encode(rightValue);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  const providedKey = req.headers.get("x-device-key")?.trim();
  if (!providedKey) {
    return json(401, { error: "unauthorized" });
  }

  const expectedKey = Deno.env.get("SENSOR_DEVICE_KEY")?.trim();
  if (!expectedKey) {
    console.error("SENSOR_DEVICE_KEY is not configured");
    return json(503, { error: "sensor ingestion is not configured" });
  }

  if (!constantTimeEquals(providedKey, expectedKey)) {
    return json(401, { error: "unauthorized" });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json(413, { error: "request body too large" });
  }

  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, { error: "content-type must be application/json" });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json(400, { error: "invalid request body" });
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: "request body too large" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "request body must be valid JSON" });
  }

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return json(400, { error: "request body must be a JSON object" });
  }

  const input = payload as Record<string, unknown>;
  const allowedFields = new Set([
    "recorded_at",
    "temperature_c",
    "ph",
    "do_mg_l",
    "turbidity_ntu",
  ]);

  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    return json(400, { error: "request contains an unsupported field" });
  }

  const recordedAt = input.recorded_at;
  const isoTimestamp = typeof recordedAt === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(recordedAt)
    && Number.isFinite(Date.parse(recordedAt));

  if (!isoTimestamp) {
    return json(400, { error: "recorded_at must be an ISO 8601 timestamp with a timezone" });
  }

  const ranges: Record<string, [number, number]> = {
    temperature_c: [-55, 125],
    ph: [0, 14],
    do_mg_l: [0, 15],
    turbidity_ntu: [0, 1000],
  };
  const record: Record<string, string | number> = {
    pond_id: BFAR_POND_ID,
    recorded_at: new Date(recordedAt as string).toISOString(),
  };

  for (const [field, [minimum, maximum]] of Object.entries(ranges)) {
    const value = input[field];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
      return json(400, { error: `${field} must be a finite number from ${minimum} to ${maximum}` });
    }
    record[field] = value;
  }

  if (Object.keys(record).length === 2) {
    return json(400, { error: "at least one sensor measurement is required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase server credentials are not configured for sensor ingestion");
    return json(503, { error: "sensor ingestion is not configured" });
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin
      .from("sensor_readings")
      .insert(record)
      .select("id, recorded_at")
      .single();

    if (error) {
      console.error("sensor_readings insert failed:", error.code ?? "unknown database error");
      return json(500, { error: "failed to store sensor reading" });
    }

    return json(201, { ok: true, id: data.id, recorded_at: data.recorded_at });
  } catch (error) {
    console.error("sensor ingestion failed:", error instanceof Error ? error.message : "unknown error");
    return json(500, { error: "failed to store sensor reading" });
  }
});
