import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState, LoadingState, LoadError } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { Users as UsersIcon, ShieldCheck, Clock, Check } from "lucide-react";
import { toast } from "sonner";

type UserProfile = Database["public"]["Tables"]["profiles"]["Row"] & {
  roles: Database["public"]["Tables"]["user_roles"]["Row"]["role"][];
};

type UserGroup = "all" | "pending" | "operators" | "admins";

const Users = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [activeGroup, setActiveGroup] = useState<UserGroup>("all");
  const load = async () => {
    setLoadError("");
    try {
      const [profilesResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;
      const merged = (profilesResult.data ?? []).map(p => ({ ...p, roles: (rolesResult.data ?? []).filter(r => r.user_id === p.id).map(r => r.role) }));
      setUsers(merged);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load users: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  useEffect(() => { void load(); }, []);

  const toggleAdmin = async (uid: string, isAdmin: boolean) => {
    if (isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
    }
    toast.success("Updated"); void load();
  };

  const setApproved = async (uid: string, approved: boolean) => {
    const { error } = await supabase.from("profiles").update({ approved }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success(approved ? "Access granted" : "Access revoked"); void load();
  };

  const pending = users.filter(u => !u.approved && !u.roles.includes("admin"));
  const operators = users.filter(u => u.approved && !u.roles.includes("admin"));
  const admins = users.filter(u => u.roles.includes("admin"));
  const allUsers = users.filter(u => u.approved || u.roles.includes("admin"));
  const groups: Record<UserGroup, UserProfile[]> = { all: allUsers, pending, operators, admins };
  const filters = [
    { key: "all", label: "All", Icon: null },
    { key: "pending", label: "Pending", Icon: Clock },
    { key: "operators", label: "Operators", Icon: UsersIcon },
    { key: "admins", label: "Admins", Icon: ShieldCheck },
  ] as const;
  const filterButtonClass = (active: boolean) => `h-9 gap-2 whitespace-nowrap rounded-md px-3.5 text-sm shadow-none transition-colors ${active
    ? "border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 hover:text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-950 dark:hover:border-cyan-300 dark:hover:bg-cyan-300 dark:hover:text-slate-950"
    : "border-border bg-background text-foreground hover:border-blue-600 hover:bg-blue-600 hover:text-white dark:hover:border-cyan-400 dark:hover:bg-cyan-400 dark:hover:text-slate-950"
    }`;
  const emptyMessages: Record<UserGroup, string> = {
    all: "No approved accounts yet.",
    pending: "No pending sign-ups.",
    operators: "No operators yet.",
    admins: "No admins yet.",
  };

  const renderRow = (u: UserProfile) => {
    const isAdmin = u.roles.includes("admin");
    const isApproved = u.approved || isAdmin;
    return (
      <div key={u.id} className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gradient-aqua text-white font-semibold shadow-sm">
            {(u.full_name || u.email || "?")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold">{u.full_name || "Unnamed"}</div>
            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {isAdmin ? (
            <Badge variant="outline" className="border-0 bg-cyan-100 text-cyan-900 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-200 dark:hover:bg-cyan-950"><ShieldCheck className="mr-1 h-3 w-3" />Admin</Badge>
          ) : isApproved ? (
            <Badge variant="secondary">{u.roles.includes("operator") ? "Operator" : "Approved"}</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
          )}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {!isApproved ? (
              <Button size="sm" className="flex-1 gradient-aqua text-white border-0 hover:opacity-90 sm:flex-none" onClick={() => setApproved(u.id, true)}>
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
            ) : (
              !isAdmin && (
                <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => setApproved(u.id, false)}>Revoke access</Button>
              )
            )}
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => toggleAdmin(u.id, isAdmin)}>
              {isAdmin ? "Revoke admin" : "Make admin"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppShell admin>
      <PageHeader title="Users" subtitle="Approve new sign-ups and manage operator and admin access." />
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div role="group" aria-label="Filter users by account type" className="flex flex-wrap gap-2 border-b border-border px-4 py-4 sm:px-5">
          {filters.map(({ key, label, Icon }) => {
            const active = activeGroup === key;
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                aria-pressed={active}
                onClick={() => setActiveGroup(key)}
                className={filterButtonClass(active)}
              >
                {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                {label}
                <span className="text-xs font-medium tabular-nums">
                  {hasLoaded ? groups[key].length : "—"}
                </span>
              </Button>
            );
          })}
        </div>
        {loadError && <div className="p-4 sm:p-5"><LoadError message={loadError} onRetry={() => void load()} /></div>}
        {!hasLoaded ? (
          loadError ? null : <LoadingState label="Loading users" />
        ) : users.length === 0 ? (
          <div className="p-6"><EmptyState icon={UsersIcon} title="No users yet." /></div>
        ) : groups[activeGroup].length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{emptyMessages[activeGroup]}</div>
        ) : (
          <div className="divide-y divide-border">{groups[activeGroup].map(renderRow)}</div>
        )}
      </Card>
    </AppShell>
  );
};
export default Users;
