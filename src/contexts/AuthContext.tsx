import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { profileDisplayName } from "@/lib/profile-name";

type Role = "admin" | "operator" | null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  approved: boolean;
  mustChangePassword: boolean;
  displayName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [approved, setApproved] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadAccess(s.user.id), 0);
      } else {
        setRole(null);
        setApproved(false);
        setMustChangePassword(false);
        setDisplayName(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadAccess(s.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadAccess = async (uid: string) => {
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("approved, must_change_password, first_name, middle_name, last_name, full_name, email").eq("id", uid).maybeSingle(),
    ]);
    const list = (roles ?? []).map(r => r.role);
    const r: Role = list.includes("admin") ? "admin" : list.includes("operator") ? "operator" : null;
    setRole(r);
    setApproved(r === "admin" ? true : !!profile?.approved);
    setMustChangePassword(!!profile?.must_change_password);
    setDisplayName(profile ? profileDisplayName(profile) : null);
    setLoading(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshAccess = async () => { if (user) await loadAccess(user.id); };

  return <Ctx.Provider value={{ user, session, role, approved, mustChangePassword, displayName, loading, signOut, refreshAccess }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
