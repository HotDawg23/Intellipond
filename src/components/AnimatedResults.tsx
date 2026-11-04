import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

type AnimatedResultsProps = {
  transitionKey: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  resize?: boolean;
  slide?: boolean;
  skipWhenPrinting?: boolean;
};

export function AnimatedResults({
  transitionKey,
  children,
  className,
  contentClassName,
  resize = true,
  slide = true,
  skipWhenPrinting = false,
}: AnimatedResultsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousKey = useRef(transitionKey);
  const previousHeight = useRef<number | null>(null);
  const activeAnimations = useRef<Animation[]>([]);

  useEffect(() => {
    if (!skipWhenPrinting) return;
    const finishBeforePrint = () => {
      activeAnimations.current.forEach(animation => animation.cancel());
      activeAnimations.current = [];
      if (containerRef.current) containerRef.current.style.overflow = "";
    };
    window.addEventListener("beforeprint", finishBeforePrint);
    return () => window.removeEventListener("beforeprint", finishBeforePrint);
  }, [skipWhenPrinting]);

  useEffect(() => {
    const content = contentRef.current;
    if (!resize || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { previousHeight.current = content.getBoundingClientRect().height; });
    observer.observe(content);
    return () => observer.disconnect();
  }, [resize]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const changed = previousKey.current !== transitionKey;
    const nextHeight = content.getBoundingClientRect().height;
    const oldHeight = previousHeight.current;
    previousKey.current = transitionKey;
    previousHeight.current = nextHeight;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const printing = skipWhenPrinting && window.matchMedia?.("print").matches;
    if (!changed || reduceMotion || printing || !content.animate || (resize && (!container.animate || !oldHeight || !nextHeight))) return;

    if (resize) container.style.overflow = "hidden";
    const fade = content.animate(
      slide
        ? [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }]
        : [{ opacity: 0 }, { opacity: 1 }],
      { duration: 260, easing: "ease-out" },
    );
    const height = resize
      ? container.animate(
        [{ height: `${oldHeight}px` }, { height: `${nextHeight}px` }],
        { duration: 260, easing: "ease-in-out" },
      )
      : null;
    activeAnimations.current = height ? [fade, height] : [fade];
    if (height) height.onfinish = () => { container.style.overflow = ""; };

    return () => {
      if (resize) previousHeight.current = container.getBoundingClientRect().height;
      fade.cancel();
      height?.cancel();
      activeAnimations.current = [];
      if (resize) container.style.overflow = "";
    };
  }, [resize, slide, skipWhenPrinting, transitionKey]);

  return <div ref={containerRef} className={className}><div ref={contentRef} className={contentClassName}>{children}</div></div>;
}
