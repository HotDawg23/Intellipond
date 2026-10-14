import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./PixelCard.css";

type PixelCardProps = {
  variant?: string;
  gap?: number;
  speed?: number;
  colors?: string;
  noFocus?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  children?: ReactNode;
};

type PixelVariant = {
  activeColor: string | null;
  gap: number;
  speed: number;
  colors: string;
  noFocus: boolean;
};

type AnimationMethod = "appear" | "disappear";

class Pixel {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly x: number;
  private readonly y: number;
  private readonly color: string;
  private readonly speed: number;
  private readonly sizeStep: number;
  private readonly maxSize: number;
  private readonly delay: number;
  private readonly counterStep: number;
  private size = 0;
  private counter = 0;
  private isIdle = false;
  private isReverse = false;
  private isShimmer = false;
  private readonly minSize = 0.5;
  private readonly maxSizeInteger = 2;

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
  ) {
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.sizeStep = Math.random() * 0.4;
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counterStep = Math.random() * 4 + (canvas.width + canvas.height) * 0.01;
  }

  private getRandomValue(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) this.isShimmer = true;
    if (this.isShimmer) this.shimmer();
    else this.size += this.sizeStep;
    this.draw();
  }

  disappear() {
    this.isShimmer = false;
    this.counter = 0;
    if (this.size <= 0) {
      this.isIdle = true;
      return;
    }
    this.size -= 0.1;
    this.draw();
  }

  private shimmer() {
    if (this.size >= this.maxSize) this.isReverse = true;
    else if (this.size <= this.minSize) this.isReverse = false;
    this.size += this.isReverse ? -this.speed : this.speed;
  }

  get idle() {
    return this.isIdle;
  }
}

const getEffectiveSpeed = (value: number, reducedMotion: boolean) => {
  if (value <= 0 || reducedMotion) return 0;
  return Math.min(value, 100) * 0.001;
};

const VARIANTS: Record<string, PixelVariant> = {
  default: {
    activeColor: null,
    gap: 5,
    speed: 35,
    colors: "#f8fafc,#f1f5f9,#cbd5e1",
    noFocus: false,
  },
  blue: {
    activeColor: "#e0f2fe",
    gap: 10,
    speed: 25,
    colors: "#e0f2fe,#7dd3fc,#0ea5e9",
    noFocus: false,
  },
  yellow: {
    activeColor: "#fef08a",
    gap: 3,
    speed: 20,
    colors: "#fef08a,#fde047,#eab308",
    noFocus: false,
  },
  pink: {
    activeColor: "#fecdd3",
    gap: 6,
    speed: 80,
    colors: "#fecdd3,#fda4af,#e11d48",
    noFocus: true,
  },
};

const PixelCard = ({
  variant = "default",
  gap,
  speed,
  colors,
  noFocus,
  className = "",
  style,
  ariaLabel,
  children,
}: PixelCardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const animationRef = useRef<number | null>(null);
  const timePreviousRef = useRef(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const variantConfig = VARIANTS[variant] ?? VARIANTS.default;
  const finalGap = gap ?? variantConfig.gap;
  const finalSpeed = speed ?? variantConfig.speed;
  const finalColors = colors ?? variantConfig.colors;
  const finalNoFocus = noFocus ?? variantConfig.noFocus;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const initPixels = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      const context = canvas.getContext("2d");
      if (!context || width === 0 || height === 0) return;

      canvas.width = width;
      canvas.height = height;
      const colorsArray = finalColors.split(",");
      const pixelGap = Math.max(1, Math.floor(finalGap));
      const effectiveSpeed = getEffectiveSpeed(finalSpeed, reducedMotion);
      const nextPixels: Pixel[] = [];

      if (effectiveSpeed > 0) {
        for (let x = 0; x < width; x += pixelGap) {
          for (let y = 0; y < height; y += pixelGap) {
            const color = colorsArray[Math.floor(Math.random() * colorsArray.length)];
            const dx = x - width / 2;
            const dy = y - height / 2;
            const delay = reducedMotion ? 0 : Math.sqrt(dx * dx + dy * dy);
            nextPixels.push(new Pixel(canvas, context, x, y, color, effectiveSpeed, delay));
          }
        }
      }
      pixelsRef.current = nextPixels;
    };

    initPixels();
    const observer = new ResizeObserver(initPixels);
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      pixelsRef.current = [];
    };
  }, [finalColors, finalGap, finalSpeed, reducedMotion]);

  const animatePixels = (method: AnimationMethod) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    animationRef.current = requestAnimationFrame(() => animatePixels(method));
    const now = performance.now();
    const elapsed = now - timePreviousRef.current;
    const frameInterval = 1000 / 60;
    if (elapsed < frameInterval) return;
    timePreviousRef.current = now - (elapsed % frameInterval);

    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);

    let allIdle = true;
    for (const pixel of pixelsRef.current) {
      pixel[method]();
      if (!pixel.idle) allIdle = false;
    }
    if (allIdle && animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const handleAnimation = (method: AnimationMethod) => {
    if (reducedMotion || pixelsRef.current.length === 0) return;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    timePreviousRef.current = performance.now();
    animationRef.current = requestAnimationFrame(() => animatePixels(method));
  };

  return (
    <div
      ref={containerRef}
      className={"pixel-card" + (className ? " " + className : "")}
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      style={{
        ...style,
        "--pixel-card-active-color": variantConfig.activeColor ?? "#09090b",
      } as CSSProperties}
      onMouseEnter={() => handleAnimation("appear")}
      onMouseLeave={() => handleAnimation("disappear")}
      onFocus={(event) => {
        if (!finalNoFocus && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          handleAnimation("appear");
        }
      }}
      onBlur={(event) => {
        if (!finalNoFocus && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          handleAnimation("disappear");
        }
      }}
      tabIndex={finalNoFocus ? -1 : 0}
    >
      <canvas className="pixel-canvas" ref={canvasRef} aria-hidden="true" />
      {children}
    </div>
  );
};

export default PixelCard;
