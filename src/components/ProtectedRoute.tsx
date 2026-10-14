import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = ({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) => {
  const { user, role, approved, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen grid place-items-center">
      <div className="h-10 w-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  if (!approved && role !== "admin") return <Navigate to="/pending-approval" replace />;
  if (adminOnly && role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
