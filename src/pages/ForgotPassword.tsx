import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, MailCheck } from "lucide-react";
import heroImg from "@/assets/hero-water.jpg";
import BrandMark from "@/components/BrandMark";
import { PublicThemeControl } from "@/components/ThemeControl";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.functions.invoke("send-reset-password-email", {
      body: {
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message ?? "Could not send reset email.");
    setSent(true);
    toast.success("Reset link sent — check your inbox.");
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
            <h2 className="text-4xl font-semibold leading-tight max-w-md">Reset your password.</h2>
            <p className="mt-4 text-white/90 max-w-md">We'll email you a secure link so you can choose a new password.</p>
          </div>
          <div className="text-xs text-white/90">Capstone research platform · IoT sensors</div>
        </div>
      </div>
      <div className="flex w-full min-w-0 items-center justify-center bg-background p-4 sm:p-6 lg:p-12">
        <Card className="w-full min-w-0 max-w-[calc(100vw_-_2rem)] border-border/60 p-6 shadow-soft sm:max-w-md sm:p-8">
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the email tied to your account and we'll send a reset link.
          </p>
          {sent ? (
            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 flex gap-3">
              <MailCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Check your email</div>
                <p className="text-muted-foreground mt-1">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is on its way. The link expires in 1 hour.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 mt-6">
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-aqua text-white border-0 hover:opacity-90" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <div className="mt-6 text-sm text-muted-foreground">
            Remembered it? <Link to="/auth" className="text-accent hover:underline">Sign in</Link>
          </div>
        </Card>
      </div>
    </div>
    </>
  );
};
export default ForgotPassword;
