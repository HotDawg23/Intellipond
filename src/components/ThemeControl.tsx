import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeControlProps = {
  className?: string;
  iconOnly?: boolean;
};

export const ThemeControl = ({ className, iconOnly = false }: ThemeControlProps) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={isDark}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => setTheme(nextTheme)}
      className={cn("shrink-0", className)}
    >
      <span aria-hidden="true" className="theme-toggle-icons">
        <Sun className={cn("theme-toggle-icon", isDark ? "theme-toggle-icon--inactive-sun" : "theme-toggle-icon--active")} />
        <Moon className={cn("theme-toggle-icon", isDark ? "theme-toggle-icon--active" : "theme-toggle-icon--inactive-moon")} />
      </span>
      {!iconOnly && <span className="ml-2">Appearance</span>}
    </Button>
  );
};

export const PublicThemeControl = () => (
  <div className="fixed right-4 top-4 z-50 rounded-md bg-background/80 shadow-sm backdrop-blur sm:right-6 sm:top-6">
    <ThemeControl iconOnly className="border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground" />
  </div>
);
