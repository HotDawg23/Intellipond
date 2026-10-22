import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type NotificationEvent = Tables<"alert_notification_events">;

const STORAGE_KEY = "intellipond:seen-alert-notifications";
const LOCK_NAME = "intellipond:alert-notification-toast";

function markSeen(id: string) {
  try {
    const now = Date.now();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Array<{ id: string; at: number }>;
    const recent = stored.filter(item => item && typeof item.id === "string" && item.at > now - 7 * 24 * 60 * 60 * 1000);
    if (recent.some(item => item.id === id)) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...recent, { id, at: now }].slice(-200)));
    return true;
  } catch {
    return true;
  }
}

function showEvent(event: NotificationEvent) {
  const title = event.notification_type === "reminder"
    ? "Water quality alert reminder"
    : event.notification_type === "escalation"
      ? "Alert escalated to critical"
      : "Water quality alert";
  const notify = event.severity === "critical" ? toast.error : toast.warning;
  notify(title, {
    description: event.recommendation ? `${event.message} ${event.recommendation}` : event.message,
    duration: event.severity === "critical" ? 12_000 : 8_000,
    action: {
      label: "View alerts",
      onClick: () => window.location.assign("/dashboard/alerts"),
    },
  });
}

export function AlertNotifications() {
  const { user, role, approved } = useAuth();

  useEffect(() => {
    if (!user || (!approved && role !== "admin")) return;

    const channel = supabase
      .channel(`alert-notifications-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alert_notification_events",
      }, payload => {
        const event = payload.new as NotificationEvent;
        const deliver = () => {
          if (markSeen(event.id)) showEvent(event);
        };
        if (navigator.locks?.request) {
          void navigator.locks.request(LOCK_NAME, deliver);
        } else {
          deliver();
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [approved, role, user]);

  return null;
}
