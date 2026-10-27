import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadError, LoadingState, PageHeader } from "@/components/Common";
import { ReportList } from "@/components/ReportList";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Report } from "@/lib/report-snapshot";

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setReports(data ?? []);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(`Could not load reports: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <AppShell>
      <PageHeader title="Reports" subtitle="Review pond reports shared with you." />
      {loadError && <div className="mb-3"><LoadError message={loadError} onRetry={() => void load()} /></div>}
      {!hasLoaded ? (loadError ? null : <Card><LoadingState label="Loading reports" /></Card>) : (
        <ReportList reports={reports} basePath="/dashboard/reports" />
      )}
    </AppShell>
  );
};

export default Reports;
