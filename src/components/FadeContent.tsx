import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type FadeContentProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  container?: string | Element | null;
  blur?: boolean;
  slideUp?: number;
  duration?: number;
  ease?: string;
  delay?: number;
  threshold?: number;
  initialOpacity?: number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
};

const getSeconds = (value: number) => (value > 10 ? value / 1000 : value);

const FadeContent = ({
  children,
  container,
  blur = false,
  slideUp = 0,
  duration = 1000,
  ease = "power2.out",
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power2.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  style,
  ...props
}: FadeContentProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    gsap.registerPlugin(ScrollTrigger);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const thresholdPercent = 100 - Math.min(1, Math.max(0, threshold)) * 100;
    const initialBounds = element.getBoundingClientRect();
    const alreadyInView = initialBounds.top <= (window.innerHeight * thresholdPercent) / 100;

    if (reducedMotion || alreadyInView) {
      gsap.set(element, { autoAlpha: 1, filter: "blur(0px)", y: 0, willChange: "auto" });
      return;
    }

    gsap.set(element, {
      autoAlpha: initialOpacity,
      filter: blur ? "blur(10px)" : "blur(0px)",
      y: slideUp,
      willChange: "opacity, filter, transform",
    });

    const timeline = gsap.timeline({
      paused: true,
      delay: getSeconds(delay),
    });

    timeline.to(element, {
      autoAlpha: 1,
      filter: "blur(0px)",
      y: 0,
      duration: getSeconds(duration),
      ease,
    });

    const suppliedContainer = typeof container === "string" ? document.querySelector(container) : container;
    const scroller = suppliedContainer || document.getElementById("snap-main-container") || window;
    const start = `top ${thresholdPercent}%`;
    const end = `bottom ${thresholdPercent}%`;
    const scrollTrigger = ScrollTrigger.create({
      trigger: element,
      scroller,
      start,
      end,
      onEnter: () => timeline.play(),
      onEnterBack: () => timeline.play(),
    });

    timeline.eventCallback("onComplete", () => {
      onComplete?.();
      if (disappearAfter > 0) {
        gsap.to(element, {
          autoAlpha: initialOpacity,
          filter: blur ? "blur(10px)" : "blur(0px)",
          delay: getSeconds(disappearAfter),
          duration: getSeconds(disappearDuration),
          ease: disappearEase,
          onComplete: onDisappearanceComplete,
        });
      }
      scrollTrigger.kill();
    });

    return () => {
      scrollTrigger?.kill();
      timeline.kill();
      gsap.killTweensOf(element);
    };
    // Values are intentionally captured at mount, matching the ScrollTrigger lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={className} style={style} {...props}>
      {children}
    </div>
  );
};

export default FadeContent;
