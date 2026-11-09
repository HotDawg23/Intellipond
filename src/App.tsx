import { initialAuthRecoveryCallback, readAuthRecoveryCallbackState } from "@/lib/auth-recovery-callback";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { lazy, Suspense, useLayoutEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AlertNotifications } from "@/components/AlertNotifications";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";

const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Growth = lazy(() => import("./pages/dashboard/Growth"));
const Alerts = lazy(() => import("./pages/dashboard/Alerts"));
const OperatorReports = lazy(() => import("./pages/dashboard/Reports"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const Sensors = lazy(() => import("./pages/admin/Sensors"));
const Ponds = lazy(() => import("./pages/admin/Ponds"));
const GrowthAdmin = lazy(() => import("./pages/admin/GrowthAdmin"));
const AlertHistory = lazy(() => import("./pages/admin/AlertHistory"));
const Users = lazy(() => import("./pages/admin/Users"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const Settings = lazy(() => import("./pages/admin/Settings"));

const queryClient = new QueryClient();

const AuthRecoveryRedirect = () => {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const navigateToResetPassword = () => {
      if (window.location.pathname === "/reset-password") return;
      // Remove callback data from the address bar rather than carrying tokens
      // into the app route.
      navigate("/reset-password", { replace: true });
    };

    const currentCallback = readAuthRecoveryCallbackState(window.location.href);
    const isRecoveryLink = initialAuthRecoveryCallback.isRecovery || currentCallback.isRecovery;
    const isExpiredRecoveryLink = initialAuthRecoveryCallback.isExpired || currentCallback.isExpired;

    if (isExpiredRecoveryLink) navigateToResetPassword();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") navigateToResetPassword();
    });

    // Wait for Supabase to process the initial URL before removing its hash.
    // The event may have fired before this component subscribed, so also check
    // for the resulting session after initialization completes.
    if (isRecoveryLink) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) navigateToResetPassword();
      });
    }

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="intellipond-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthRecoveryRedirect />
          <AuthProvider>
            <AlertNotifications />
            <Suspense
              fallback={
                <div className="min-h-screen bg-background grid place-items-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Loading page…
                  </div>
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/pending-approval" element={<PendingApproval />} />

                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/dashboard/growth" element={<ProtectedRoute><Growth /></ProtectedRoute>} />
                <Route path="/dashboard/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                <Route path="/dashboard/reports" element={<ProtectedRoute><OperatorReports /></ProtectedRoute>} />
                <Route path="/dashboard/reports/:id" element={<ProtectedRoute><ReportDetail /></ProtectedRoute>} />

                <Route path="/admin" element={<ProtectedRoute adminOnly><AdminOverview /></ProtectedRoute>} />
                <Route path="/admin/sensors" element={<ProtectedRoute adminOnly><Sensors /></ProtectedRoute>} />
                <Route path="/admin/ponds" element={<ProtectedRoute adminOnly><Ponds /></ProtectedRoute>} />
                <Route path="/admin/growth" element={<ProtectedRoute adminOnly><GrowthAdmin /></ProtectedRoute>} />
                <Route path="/admin/alerts" element={<ProtectedRoute adminOnly><AlertHistory /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
                <Route path="/admin/reports/:id" element={<ProtectedRoute adminOnly><ReportDetail admin /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
