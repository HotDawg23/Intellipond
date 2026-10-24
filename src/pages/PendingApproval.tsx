import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import BrandMark from "@/components/BrandMark";
import { PublicThemeControl } from "@/components/ThemeControl";

const PendingApproval = () => {
  const { user, approved, role, signOut, loading } = useAuth();
  const nav = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) nav("/auth", { replace: true });
    else if (approved || role === "admin") nav("/dashboard", { replace: true });
  }, [user, approved, role, loading, nav]);

  const refresh = async () => {
    setChecking(true);
    const { data } = await supabase.from("profiles").select("approved").eq("id", user!.id).maybeSingle();
    setChecking(false);
    if (data?.approved) { toast.success("Access granted"); nav("/dashboard", { replace: true }); }
    else toast.info("Still awaiting admin approval");
  };

  return (
    <>
    <PublicThemeControl />
    <div className="min-h-screen grid place-items-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-md border-border/60 p-6 text-center shadow-soft sm:p-8">
        <BrandMark className="mx-auto h-14 w-14 rounded-2xl mb-4" />
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground mb-4">
          <Clock className="h-3 w-3" /> Awaiting approval
        </div>
        <h1 className="text-2xl font-semibold">Account pending review</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your IntelliPond account has been created. An administrator must approve access before
          you can use the operator console.
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <Button onClick={refresh} disabled={checking} className="gradient-aqua text-white border-0 hover:opacity-90">
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} /> Check again
          </Button>
          <Button variant="ghost" onClick={() => signOut().then(() => nav("/auth"))}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </Card>
    </div>
    </>
  );
};
export default PendingApproval;
