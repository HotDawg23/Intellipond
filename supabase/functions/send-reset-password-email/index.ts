import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "tsunaalfonso@gmail.com";
const FROM_NAME = "IntelliPond";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, redirectTo } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Generate a recovery link via admin API (does NOT send any email)
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
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
