import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, ShieldCheck, Clock, Check } from "lucide-react";
import { toast } from "sonner";

const Users = () => {
  const [users, setUsers] = useState<any[]>([]);
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
  const active = users.filter(u => u.approved || u.roles.includes("admin"));

  const renderRow = (u: any) => {
    const isAdmin = u.roles.includes("admin");
    const isApproved = u.approved || isAdmin;
    return (
      <div key={u.id} className="p-4 flex items-center gap-4 flex-wrap">
        <div className="h-10 w-10 rounded-full gradient-aqua grid place-items-center text-white font-medium">
          {(u.full_name || u.email || "?")[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{u.full_name || "Unnamed"}</div>
          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
        </div>
        {isAdmin && <Badge className="bg-accent text-accent-foreground border-0"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>}
        {!isApproved && <Badge variant="outline" className="text-muted-foreground"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
        {!isApproved ? (
          <Button size="sm" className="gradient-aqua text-white border-0 hover:opacity-90" onClick={() => setApproved(u.id, true)}>
            <Check className="h-4 w-4 mr-1" /> Approve
          </Button>
        ) : (
          !isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setApproved(u.id, false)}>Revoke access</Button>
          )
        )}
        <Button size="sm" variant="outline" onClick={() => toggleAdmin(u.id, isAdmin)}>
          {isAdmin ? "Revoke admin" : "Make admin"}
        </Button>
      </div>
    );
  };

  return (
    <AppShell admin>
      <PageHeader title="Users" subtitle="Approve new sign-ups and manage operator and admin access." />
      {users.length === 0 ? (
        <Card className="p-6"><EmptyState icon={UsersIcon} title="No users yet." /></Card>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Pending approval
              <Badge variant="outline" className="ml-1">{pending.length}</Badge>
            </div>
            <Card className="divide-y divide-border">
              {pending.length === 0
                ? <div className="p-6 text-sm text-muted-foreground text-center">No pending sign-ups.</div>
                : pending.map(renderRow)}
            </Card>
          </div>
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Active accounts
              <Badge variant="outline" className="ml-1">{active.length}</Badge>
            </div>
            <Card className="divide-y divide-border">
              {active.map(renderRow)}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
};
export default Users;
