import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, Fish, Bell, Settings, Database, Users, FileText, LogOut, Waves, Sliders, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import BrandMark from "@/components/BrandMark";

const userNav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/growth", label: "Growth", icon: Fish },
  { to: "/dashboard/alerts", label: "Alerts", icon: Bell },
];

const adminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/sensors", label: "Sensors", icon: Database },
  { to: "/admin/ponds", label: "Ponds", icon: Waves },
  { to: "/admin/growth", label: "Growth Records", icon: Fish },
  { to: "/admin/alerts", label: "Alert History", icon: Bell },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Sliders },
];

const SidebarContent = ({
  admin, items, user, role, onNavigate, onSignOut,
}: {
  admin: boolean;
  items: typeof userNav;
  user: ReturnType<typeof useAuth>["user"];
  role: string | null;
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}) => (
  <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
    <Link to="/" className="px-6 py-6 flex items-center gap-2 border-b border-sidebar-border" onClick={() => onNavigate("/")}>
      <BrandMark className="h-9 w-9 rounded-xl shadow-glow" />
      <div>
        <div className="font-semibold tracking-tight text-sidebar-primary-foreground">IntelliPond</div>
        <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">{admin ? "Admin Console" : "Operator"}</div>
      </div>
    </Link>
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end
          onClick={() => onNavigate(to)}
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
            isActive ? "bg-sidebar-accent text-sidebar-primary-foreground shadow-soft" : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
          )}>
          <Icon className="h-4 w-4" />{label}
        </NavLink>
      ))}
    </nav>
    <div className="p-3 border-t border-sidebar-border space-y-2">
      {role === "admin" && !admin && (
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => onNavigate("/admin")}>
          <Settings className="h-4 w-4 mr-2" /> Switch to Admin
        </Button>
      )}
      {admin && (
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => onNavigate("/dashboard")}>
          <LayoutDashboard className="h-4 w-4 mr-2" /> Operator View
        </Button>
      )}
      <div className="px-2 py-1.5 text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
      <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={onSignOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>
    </div>
  </div>
);

export const AppShell = ({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) => {
  const { signOut, user, role } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const items = admin ? adminNav : userNav;

  const handleNavigate = (to: string) => {
    setOpen(false);
    nav(to);
  };
  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    nav("/");
  };

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-secondary/30">
      <aside className="sticky top-0 h-screen w-64 shrink-0 hidden md:flex">
        <SidebarContent admin={admin} items={items} user={user} role={role} onNavigate={(to) => nav(to)} onSignOut={handleSignOut} />
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-sidebar border-0">
                <SidebarContent admin={admin} items={items} user={user} role={role} onNavigate={handleNavigate} onSignOut={handleSignOut} />
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2">
              <BrandMark className="h-7 w-7 rounded-lg" />
              <span className="font-semibold">IntelliPond</span>
            </Link>
          </div>
          <Button size="icon" variant="ghost" onClick={handleSignOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};
