import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandMark from "@/components/BrandMark";
import { toast } from "sonner";

const InitialPassword = () => {
  const { user, mustChangePassword, loading, refreshAccess, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="min-h-screen grid place-items-center">Loading account…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!mustChangePassword) return <Navigate to="/dashboard" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setSaving(true);
    const { error } = await supabase.functions.invoke("change-initial-password", { body: { password } });
    if (error) {
      let message = error.message;
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        message = body?.error || message;
      }
      setSaving(false);
      return toast.error(message);
    }
    await refreshAccess();
    setSaving(false);
    toast.success("Password changed.");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-md border-border/60 p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-3 mb-6"><BrandMark className="h-10 w-10 rounded-xl" /><span className="font-semibold">IntelliPond</span></div>
        <h1 className="text-2xl font-semibold">Choose your password</h1>
        <p className="text-sm text-muted-foreground mt-2">Replace the initial password provided by your administrator before opening the dashboard.</p>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></div>
          <div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></div>
          <Button type="submit" disabled={saving} className="w-full gradient-aqua text-white border-0 hover:opacity-90">{saving ? "Saving…" : "Save password"}</Button>
        </form>
        <Button variant="ghost" className="w-full mt-3" onClick={() => void signOut()}>Sign out</Button>
      </Card>
    </div>
  );
};

export default InitialPassword;
