import { useRef, type CSSProperties, type HTMLAttributes, type MouseEvent } from "react";
import "./SpotlightCard.css";

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
};

const SpotlightCard = ({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.25)",
  onMouseMove,
  style,
  ...props
}: SpotlightCardProps) => {
  const divRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const element = divRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
      element.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
      element.style.setProperty("--spotlight-color", spotlightColor);
    }

    onMouseMove?.(event);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`card-spotlight ${className}`.trim()}
      style={{ ...style, "--spotlight-color": spotlightColor } as CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
};

export default SpotlightCard;
