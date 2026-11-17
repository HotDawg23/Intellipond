import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { AnimatedResults } from "@/components/AnimatedResults";
import { PageHeader, EmptyState, LoadingState, LoadError } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { profileDisplayName } from "@/lib/profile-name";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { Users as UsersIcon, ShieldCheck, Clock, Check, UserPlus, Pencil } from "lucide-react";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newMiddleName, setNewMiddleName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
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

  const createOperator = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    const { error } = await supabase.functions.invoke("create-operator", {
      body: { firstName: newFirstName.trim(), middleName: newMiddleName.trim(), lastName: newLastName.trim(),
        email: newEmail.trim(), password: initialPassword },
    });
    setCreating(false);
    if (error) {
      let message = error.message;
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        message = body?.error || message;
      }
      return toast.error(message);
    }
    setNewFirstName(""); setNewMiddleName(""); setNewLastName(""); setNewEmail(""); setInitialPassword("");
    setCreateOpen(false);
    setActiveGroup("operators");
    toast.success("Operator account created. Share the initial password privately.");
    void load();
  };

  const openEditName = (profile: UserProfile) => {
    setEditingUser(profile);
    setEditFirstName(profile.first_name ?? "");
    setEditMiddleName(profile.middle_name ?? "");
    setEditLastName(profile.last_name ?? "");
  };

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    const firstName = editFirstName.trim();
    const lastName = editLastName.trim();
    if (!firstName || !lastName) return toast.error("First and last names are required.");
    setSavingName(true);
    const { error } = await supabase.from("profiles")
      .update({ first_name: firstName, middle_name: editMiddleName.trim() || null, last_name: lastName,
        full_name: null, updated_at: new Date().toISOString() })
      .eq("id", editingUser.id).select("id").single();
    setSavingName(false);
    if (error) return toast.error(`Could not save name: ${error.message}`);
    setEditingUser(null);
    toast.success("Name updated");
    void load();
  };

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
  const selectedFilter = filters.find(filter => filter.key === activeGroup);
  const SelectedIcon = selectedFilter?.Icon;
  const emptyMessages: Record<UserGroup, string> = {
    all: "No approved accounts yet.",
    pending: "No pending legacy accounts.",
    operators: "No operators yet.",
    admins: "No admins yet.",
  };

  const renderRow = (u: UserProfile) => {
    const isAdmin = u.roles.includes("admin");
    const isApproved = u.approved || isAdmin;
    const displayName = profileDisplayName(u);
    return (
      <div key={u.id} className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gradient-aqua text-white font-semibold shadow-sm">
            {displayName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 max-w-full truncate font-semibold">{displayName}</span>
              {isAdmin ? (
                <Badge variant="outline" className="border-0 bg-cyan-100 text-cyan-900 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-200 dark:hover:bg-cyan-950"><ShieldCheck className="mr-1 h-3 w-3" />Admin</Badge>
              ) : isApproved ? (
                <Badge variant="secondary">{u.roles.includes("operator") ? "Operator" : "Approved"}</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><Clock className="mr-1 h-3 w-3" />Pending</Badge>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => openEditName(u)}>
            <Pencil className="mr-1 h-4 w-4" />Edit name
          </Button>
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
    );
  };

  return (
    <AppShell admin>
      <PageHeader title="Users" subtitle="Create operator accounts and manage existing access." />
      <div className="mb-5">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button className="gradient-aqua text-white border-0 hover:opacity-90"><UserPlus className="mr-2 h-4 w-4" />Create operator</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create operator account</DialogTitle>
              <DialogDescription>The operator can sign in immediately, then must choose a new password.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createOperator} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0"><Label htmlFor="operator-first-name">First name</Label><Input id="operator-first-name" required maxLength={120} value={newFirstName} onChange={event => setNewFirstName(event.target.value)} /></div>
                <div className="min-w-0"><Label htmlFor="operator-last-name">Last name</Label><Input id="operator-last-name" required maxLength={120} value={newLastName} onChange={event => setNewLastName(event.target.value)} /></div>
              </div>
              <div><Label htmlFor="operator-middle-name">Middle name (optional)</Label><Input id="operator-middle-name" maxLength={120} value={newMiddleName} onChange={event => setNewMiddleName(event.target.value)} /></div>
              <div><Label htmlFor="operator-email">Email</Label><Input id="operator-email" type="email" required autoComplete="off" value={newEmail} onChange={event => setNewEmail(event.target.value)} /></div>
              <div><Label htmlFor="operator-password">Initial password</Label><Input id="operator-password" type="password" required minLength={8} autoComplete="new-password" value={initialPassword} onChange={event => setInitialPassword(event.target.value)} /></div>
              <p className="text-xs text-muted-foreground">Share this password with the operator privately. It will not be shown again.</p>
              <Button type="submit" disabled={creating} className="w-full gradient-aqua text-white border-0 hover:opacity-90">{creating ? "Creating…" : "Create operator"}</Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={!!editingUser} onOpenChange={open => { if (!open) setEditingUser(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit account name</DialogTitle>
              <DialogDescription>Review the name for {editingUser?.email || "this account"}.</DialogDescription>
            </DialogHeader>
            {editingUser?.full_name && <p className="text-sm text-muted-foreground">Previous full name: <span className="font-medium text-foreground">{editingUser.full_name}</span></p>}
            <form onSubmit={saveName} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0"><Label htmlFor="edit-first-name">First name</Label><Input id="edit-first-name" required maxLength={120} value={editFirstName} onChange={event => setEditFirstName(event.target.value)} /></div>
                <div className="min-w-0"><Label htmlFor="edit-last-name">Last name</Label><Input id="edit-last-name" required maxLength={120} value={editLastName} onChange={event => setEditLastName(event.target.value)} /></div>
              </div>
              <div><Label htmlFor="edit-middle-name">Middle name (optional)</Label><Input id="edit-middle-name" maxLength={120} value={editMiddleName} onChange={event => setEditMiddleName(event.target.value)} /></div>
              <Button type="submit" disabled={savingName} className="w-full gradient-aqua text-white border-0 hover:opacity-90">{savingName ? "Saving…" : "Save name"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <Select value={activeGroup} onValueChange={(value: UserGroup) => setActiveGroup(value)}>
            <SelectTrigger aria-label="Filter users by account type" className="w-full sm:w-56">
              <SelectValue>
                <span className="inline-flex items-center gap-2">
                  {SelectedIcon && <SelectedIcon className="h-4 w-4" aria-hidden="true" />}
                  {selectedFilter?.label}
                  <span className="text-sm font-semibold tabular-nums">({hasLoaded ? groups[activeGroup].length : "—"})</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {filters.map(({ key, label, Icon }) => (
                <SelectItem key={key} value={key} textValue={label}>
                  <span className="inline-flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                    <span>{label}</span>
                    <span className="text-sm font-semibold tabular-nums text-inherit">
                      ({hasLoaded ? groups[key].length : "—"})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loadError && <div className="p-4 sm:p-5"><LoadError message={loadError} onRetry={() => void load()} /></div>}
        <AnimatedResults transitionKey={activeGroup}>
        {!hasLoaded ? (
          loadError ? null : <LoadingState label="Loading users" />
        ) : users.length === 0 ? (
          <div className="p-6"><EmptyState icon={UsersIcon} title="No users yet." /></div>
        ) : groups[activeGroup].length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{emptyMessages[activeGroup]}</div>
        ) : (
          <div className="divide-y divide-border">{groups[activeGroup].map(renderRow)}</div>
        )}
        </AnimatedResults>
      </Card>
    </AppShell>
  );
};
export default Users;
