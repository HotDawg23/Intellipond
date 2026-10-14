import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Waves, Database, Bell, Users, Fish } from "lucide-react";

const AdminOverview = () => {
  const [counts, setCounts] = useState({ ponds: 0, readings: 0, alerts: 0, growth: 0, users: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from("pond_profiles").select("id", { count: "exact", head: true }),
      supabase.from("sensor_readings").select("id", { count: "exact", head: true }),
      supabase.from("alerts").select("id", { count: "exact", head: true }),
      supabase.from("bangus_growth_records").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]).then(([ponds, readings, alerts, growth, users]) => setCounts({
      ponds: ponds.count ?? 0,
      readings: readings.count ?? 0,
      alerts: alerts.count ?? 0,
      growth: growth.count ?? 0,
      users: users.count ?? 0,
    }));
  }, []);

  const tiles = [
    { icon: Waves, label: "Pond profiles", val: counts.ponds },
    { icon: Database, label: "Sensor readings", val: counts.readings },
    { icon: Bell, label: "Alerts", val: counts.alerts },
    { icon: Fish, label: "Growth records", val: counts.growth },
    { icon: Users, label: "Users", val: counts.users },
  ];

  return (
    <AppShell admin>
      <PageHeader title="Admin Console" subtitle="System-wide visibility for IntelliPond." />
      <div className="grid md:grid-cols-3 gap-4">
        {tiles.map((t, i) => (
          <Card
            key={t.label}
            className="p-6 animate-fade-in hover-scale transition-shadow hover:shadow-[var(--shadow-elevated)]"
            style={{ animationDelay: `${i * 70}ms`, animationFillMode: "both" }}
          >
            <t.icon className="h-5 w-5 text-accent mb-3 transition-transform group-hover:scale-110" />
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className="font-mono text-3xl mt-1">{t.val}</div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
};
export default AdminOverview;
