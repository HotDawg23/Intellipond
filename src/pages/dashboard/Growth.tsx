import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState } from "@/components/Common";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Fish } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { format } from "date-fns";

const Growth = () => {
  const [records, setRecords] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("bangus_growth_records").select("*").order("recorded_at").then(({ data }) => setRecords(data ?? []));
  }, []);

  const latest = records[records.length - 1];

  return (
    <AppShell>
      <PageHeader title="Growth Monitoring" subtitle="Track Bangus development across time." />
      {records.length === 0 ? (
        <Card className="p-6"><EmptyState icon={Fish} title="No growth records found." description="Recorded growth data from your operator team will appear here." /></Card>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Stat label="Latest weight" val={`${latest.avg_weight_g ?? "—"} g`} />
            <Stat label="Latest length" val={`${latest.avg_length_cm ?? "—"} cm`} />
            <Stat label="Age" val={`${latest.age_days ?? "—"} days`} />
            <Stat label="Status" val={latest.growth_status ?? "—"} />
          </div>
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Growth Trend</h3>
            <div className="h-80 min-h-[20rem]">
              <div key={records[records.length - 1]?.id ?? records.length} className="h-full w-full animate-fade-in">
                <ResponsiveContainer>
                  <LineChart data={records.map(r => ({ ...r, t: format(new Date(r.recorded_at), "MMM d") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="avg_weight_g" stroke="hsl(var(--accent))" strokeWidth={2} name="Weight (g)" isAnimationActive animationDuration={600} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="avg_length_cm" stroke="hsl(var(--success))" strokeWidth={2} name="Length (cm)" isAnimationActive animationDuration={600} animationEasing="ease-out" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
};
const Stat = ({ label, val }: any) => (
  <div className="stat-tile"><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="font-mono text-2xl mt-1">{val}</div></div>
);
export default Growth;
