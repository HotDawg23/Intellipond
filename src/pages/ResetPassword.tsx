import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import heroImg from "@/assets/hero-water.jpg";
import BrandMark from "@/components/BrandMark";
import { PublicThemeControl } from "@/components/ThemeControl";

const ResetPassword = () => {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits a PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If the user navigates here without a recovery link but is already signed in,
    // still allow them to change their password.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    nav("/auth");
  };

  return (
    <>
    <PublicThemeControl />
    <div className="grid min-h-screen w-full min-w-0 grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden lg:block overflow-hidden">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 gradient-deep opacity-80" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Link to="/auth" className="flex items-center gap-2 text-white/90 hover:text-white text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-6">
              <BrandMark className="h-10 w-10 rounded-xl" />
              <span className="font-semibold text-lg">IntelliPond</span>
            </div>
            <h2 className="text-4xl font-semibold leading-tight max-w-md">Choose a new password.</h2>
            <p className="mt-4 text-white/90 max-w-md">Use at least 8 characters. Mixing letters, numbers and symbols helps.</p>
          </div>
          <div className="text-xs text-white/90">Capstone research platform · IoT sensors</div>
        </div>
      </div>
      <div className="flex w-full min-w-0 items-center justify-center bg-background p-4 sm:p-6 lg:p-12">
        <Card className="w-full min-w-0 max-w-[calc(100vw_-_2rem)] border-border/60 p-6 shadow-soft sm:max-w-md sm:p-8">
          <h1 className="text-2xl font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-accent" /> Secured by your one-time reset link.
          </p>
          {!ready ? (
            <div className="mt-6 text-sm text-muted-foreground">
              Waiting for a valid reset link… If you arrived here directly, request a new link from the{" "}
              <Link to="/forgot-password" className="text-accent hover:underline">Forgot password</Link> page.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 mt-6">
              <div>
                <Label>New password</Label>
                <Input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-aqua text-white border-0 hover:opacity-90" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
    </>
  );
};
export default ResetPassword;
