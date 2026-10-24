import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeControlProps = {
  className?: string;
  iconOnly?: boolean;
};

export const ThemeControl = ({ className, iconOnly = false }: ThemeControlProps) => {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          aria-label="Change appearance"
          title="Change appearance"
          className={cn("shrink-0", className)}
        >
          <Icon aria-hidden="true" className={cn("h-4 w-4", !iconOnly && "mr-2")} />
          {!iconOnly && <span>Appearance</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system"><Monitor aria-hidden="true" className="mr-2 h-4 w-4" />System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light"><Sun aria-hidden="true" className="mr-2 h-4 w-4" />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon aria-hidden="true" className="mr-2 h-4 w-4" />Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const PublicThemeControl = () => (
  <div className="fixed right-4 top-4 z-50 rounded-md bg-background/80 shadow-sm backdrop-blur sm:right-6 sm:top-6">
    <ThemeControl iconOnly className="border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground" />
  </div>
);
