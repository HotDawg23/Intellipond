import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
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

const Users = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const load = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    const merged = (profiles ?? []).map(p => ({ ...p, roles: (roles ?? []).filter(r => r.user_id === p.id).map(r => r.role) }));
    setUsers(merged);
  };
  useEffect(() => { load(); }, []);

  const toggleAdmin = async (uid: string, isAdmin: boolean) => {
    if (isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
    }
    toast.success("Updated"); load();
  };

  const setApproved = async (uid: string, approved: boolean) => {
    const { error } = await supabase.from("profiles").update({ approved }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success(approved ? "Access granted" : "Access revoked"); load();
  };

  const pending = users.filter(u => !u.approved && !u.roles.includes("admin"));
  const operators = users.filter(u => u.approved && !u.roles.includes("admin"));
  const admins = users.filter(u => u.roles.includes("admin"));

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
            <Badge className="border-0 bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200"><ShieldCheck className="mr-1 h-3 w-3" />Admin</Badge>
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
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Pending approval", count: pending.length, Icon: Clock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
          { label: "Operators", count: operators.length, Icon: UsersIcon, tone: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" },
          { label: "Admins", count: admins.length, Icon: ShieldCheck, tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
        ].map(({ label, count, Icon, tone }) => (
          <Card key={label} className="flex items-center gap-4 border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold leading-tight tabular-nums">{count}</p>
            </div>
          </Card>
        ))}
      </div>
      {users.length === 0 ? (
        <Card className="p-6"><EmptyState icon={UsersIcon} title="No users yet." /></Card>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="mb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold"><Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />Pending approval</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Review new sign-ups before they can access the system.</p>
            </div>
            <Card className="divide-y divide-border overflow-hidden border-border/70 bg-amber-50/20 shadow-sm dark:bg-amber-950/10">
              {pending.length === 0
                ? <div className="p-6 text-sm text-muted-foreground text-center">No pending sign-ups.</div>
                : pending.map(renderRow)}
            </Card>
          </div>
          <div>
            <div className="mb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold"><UsersIcon className="h-4 w-4 text-cyan-600" aria-hidden="true" />Operators</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Manage approved accounts and operator access.</p>
            </div>
            <Card className="divide-y divide-border overflow-hidden border-border/70 shadow-sm">
              {operators.length === 0
                ? <div className="p-6 text-center text-sm text-muted-foreground">No operators yet.</div>
                : operators.map(renderRow)}
            </Card>
          </div>
          <div>
            <div className="mb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />Admins</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Accounts with administrator access.</p>
            </div>
            <Card className="divide-y divide-border overflow-hidden border-border/70 shadow-sm">
              {admins.length === 0
                ? <div className="p-6 text-center text-sm text-muted-foreground">No admins yet.</div>
                : admins.map(renderRow)}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
};
export default Users;
