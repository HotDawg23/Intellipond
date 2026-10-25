import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import authBackgroundImg from "@/assets/auth-dashboard-bg.png";
import BrandMark from "@/components/BrandMark";
import { ThemeControl } from "@/components/ThemeControl";

const Auth = () => {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) nav("/dashboard");
    });
  }, [nav]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    nav("/dashboard");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/pending-approval`, data: { full_name: fullName } }
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — awaiting admin approval");
    nav("/pending-approval");
  };

  return (
    <div className="auth-page grid min-h-screen w-full min-w-0 grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden lg:block overflow-hidden gradient-deep">
        <img src={authBackgroundImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-10" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2 text-white/90 hover:text-white text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-6">
              <BrandMark className="h-10 w-10 rounded-xl" />
              <span className="font-semibold text-lg">IntelliPond</span>
            </div>
            <h2 className="text-4xl font-semibold leading-tight max-w-md">Real-time intelligence for Bangus aquaculture.</h2>
            <p className="mt-4 text-white/90 max-w-md">Monitor water quality and growth in one clear operator console.</p>
          </div>
          <div className="text-xs text-white/90">CAPSTONE PROJECT S.Y. 2026-2027 | DELTAFORCE</div>
        </div>
      </div>
      <div className="relative flex w-full min-w-0 items-center justify-center bg-background p-4 sm:p-6 lg:p-12">
        <Link
          to="/"
          className="absolute z-10 flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
            left: "calc(env(safe-area-inset-left, 0px) + 1rem)",
          }}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to home
        </Link>
        <Card className="w-full min-w-0 max-w-[calc(100vw_-_2rem)] border-border/60 p-6 shadow-soft sm:max-w-md sm:p-8">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <span className="font-semibold">IntelliPond</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Operator Access</h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your monitoring console.</p>
            </div>
            <ThemeControl iconOnly className="border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground" />
          </div>
          <Tabs defaultValue={initialTab} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full"><TabsTrigger value="signin">Sign in</TabsTrigger><TabsTrigger value="signup">Create account</TabsTrigger></TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-6">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Password</Label>
                    <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot password?</Link>
                  </div>
                  <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full gradient-aqua text-white border-0 hover:opacity-90" disabled={loading} aria-busy={loading}>
                  {loading ? <>Signing in <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /></> : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-6">
                <div><Label>Full name</Label><Input required value={fullName} onChange={e => setFullName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full gradient-aqua text-white border-0 hover:opacity-90" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};
export default Auth;
