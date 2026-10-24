import { useEffect, useRef, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  startAtZero?: boolean;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const AnimatedNumber = ({ value, decimals = 0, startAtZero = false }: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = useState(() => startAtZero && !prefersReducedMotion() ? 0 : value);
  const displayedValue = useRef(displayValue);

  useEffect(() => {
    if (prefersReducedMotion() || typeof window.requestAnimationFrame !== "function") {
      displayedValue.current = value;
      setDisplayValue(value);
      return;
    }

    const from = displayedValue.current;
    if (from === value) return;

    let frame: number;
    let startedAt: number | null = null;
    const animate = (time: number) => {
      if (startedAt === null) startedAt = time;
      const progress = Math.min((time - startedAt) / 550, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      displayedValue.current = from + (value - from) * eased;
      setDisplayValue(displayedValue.current);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return decimals === 0
    ? Math.round(displayValue).toLocaleString()
    : displayValue.toFixed(decimals);
};
