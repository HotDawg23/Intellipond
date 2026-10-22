import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AlertNotifications } from "@/components/AlertNotifications";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";

const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Growth = lazy(() => import("./pages/dashboard/Growth"));
const Alerts = lazy(() => import("./pages/dashboard/Alerts"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const Sensors = lazy(() => import("./pages/admin/Sensors"));
const Ponds = lazy(() => import("./pages/admin/Ponds"));
const GrowthAdmin = lazy(() => import("./pages/admin/GrowthAdmin"));
const AlertHistory = lazy(() => import("./pages/admin/AlertHistory"));
const Users = lazy(() => import("./pages/admin/Users"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const Settings = lazy(() => import("./pages/admin/Settings"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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

              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminOverview /></ProtectedRoute>} />
              <Route path="/admin/sensors" element={<ProtectedRoute adminOnly><Sensors /></ProtectedRoute>} />
              <Route path="/admin/ponds" element={<ProtectedRoute adminOnly><Ponds /></ProtectedRoute>} />
              <Route path="/admin/growth" element={<ProtectedRoute adminOnly><GrowthAdmin /></ProtectedRoute>} />
              <Route path="/admin/alerts" element={<ProtectedRoute adminOnly><AlertHistory /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
              <Route path="/admin/reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
