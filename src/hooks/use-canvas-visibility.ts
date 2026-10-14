import { useEffect, useRef, useState } from "react";

export function useCanvasVisibility(initiallyVisible = true, rootMargin = "120px") {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(initiallyVisible);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { rootMargin });

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { containerRef, isVisible };
}
