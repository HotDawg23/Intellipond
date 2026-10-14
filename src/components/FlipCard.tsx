import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { MotionStyle } from "motion/react";
import "./FlipCard.css";

type Axis = "x" | "y";

type FlipCardProps = {
  front?: ReactNode;
  back?: ReactNode;
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  axis?: Axis;
  flipOnClick?: boolean;
  draggable?: boolean;
  dragDistance?: number;
  tilt?: boolean;
  tiltMax?: number;
  glare?: boolean;
  glareOpacity?: number;
  hoverScale?: number;
  perspective?: number;
  stiffness?: number;
  damping?: number;
  width?: number;
  height?: number;
  radius?: number;
  background?: string;
  color?: string;
  shadow?: boolean;
  shadowColor?: string;
  shadowOpacity?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

type DragHistory = { t: number; v: number };
type Grip = {
  id: number;
  x: number;
  y: number;
  base: number;
  moved: boolean;
  slop: number;
  hist: DragHistory[];
};

const SLOP = { fine: 4, coarse: 8 };
const TILT_SPRING = { stiffness: 240, damping: 24, mass: 0.6 };
const LIFT_SPRING = { stiffness: 320, damping: 26 };
const FLING = 0.16;
const HISTORY_MS = 90;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const snap = (degrees: number) => Math.round(degrees / 180) * 180;
const isBack = (degrees: number) => Math.abs(Math.round(degrees / 180)) % 2 === 1;

const FlipCard = ({
  front = null,
  back = null,
  flipped,
  defaultFlipped = false,
  onFlipChange,
  axis = "y",
  flipOnClick = true,
  draggable = true,
  dragDistance = 0,
  tilt = true,
  tiltMax = 12,
  glare = true,
  glareOpacity = 0.22,
  hoverScale = 1.03,
  perspective = 1100,
  stiffness = 170,
  damping = 20,
  width = 300,
  height = 400,
  radius = 22,
  background = "#27272a",
  color = "#f5f5f5",
  shadow = true,
  shadowColor = "#000000",
  shadowOpacity = 0.45,
  disabled = false,
  ariaLabel = "Flip card",
  className = "",
}: FlipCardProps) => {
  const reduce = useReducedMotion();
  const controlled = flipped !== undefined;
  const [inner, setInner] = useState(defaultFlipped);
  const [dragging, setDragging] = useState(false);
  const shown = controlled ? flipped : inner;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const rootRef = useRef<HTMLDivElement>(null);
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const grip = useRef<Grip | null>(null);
  const spin = useRef<ReturnType<typeof animate> | null>(null);
  const target = useRef(shown ? 180 : 0);

  const turn = useMotionValue(shown ? 180 : 0);
  const tiltX = useSpring(0, TILT_SPRING);
  const tiltY = useSpring(0, TILT_SPRING);
  const lift = useSpring(1, LIFT_SPRING);
  const sheen = useSpring(0, LIFT_SPRING);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);

  const sumX = useTransform<number, number>([turn, tiltX], ([turnValue, tiltValue]) => turnValue + tiltValue);
  const sumY = useTransform<number, number>([turn, tiltY], ([turnValue, tiltValue]) => turnValue + tiltValue);
  const turnY = useTransform<number, string>(
    [tiltX, sumY, lift],
    ([x, y, scale]) => "perspective(" + perspective + "px) scale(" + scale + ") rotateX(" + x + "deg) rotateY(" + y + "deg)",
  );
  const turnX = useTransform<number, string>(
    [tiltY, sumX, lift],
    ([y, x, scale]) => "perspective(" + perspective + "px) scale(" + scale + ") rotateY(" + y + "deg) rotateX(" + x + "deg)",
  );
  const facing = useTransform(turn, (degrees) => Math.abs(Math.cos((degrees * Math.PI) / 180)));
  const spread = useTransform(facing, (value) => 0.08 + 0.92 * value);
  const shade = useTransform(facing, (value) => 0.1 + 0.9 * value * value);
  const gxPercent = useTransform(gx, (value) => value + "%");
  const gyPercent = useTransform(gy, (value) => value + "%");

  const settle = (destination: number, velocity: number, instant: boolean) => {
    spin.current?.stop();
    target.current = destination;
    if (instant || reduce) turn.jump(destination);
    else spin.current = animate(turn, destination, { type: "spring", stiffness, damping, velocity, restDelta: 0.05 });

    const next = isBack(destination);
    if (next === shownRef.current) return;
    shownRef.current = next;
    if (!controlled) setInner(next);
    onFlipChange?.(next);
  };

  const flip = (instant: boolean) => {
    const base = snap(turn.get());
    settle(isBack(base) ? base - 180 : base + 180, 0, instant);
  };

  const rest = () => {
    tiltX.set(0);
    tiltY.set(0);
    sheen.set(0);
    lift.set(1);
  };

  useEffect(() => {
    if (!controlled || isBack(target.current) === flipped) return;
    const base = target.current;
    spin.current?.stop();
    target.current = isBack(base) ? base - 180 : base + 180;
    if (reduce) turn.jump(target.current);
    else spin.current = animate(turn, target.current, { type: "spring", stiffness, damping, restDelta: 0.05 });
  }, [controlled, damping, flipped, reduce, stiffness, turn]);

  useEffect(() => () => spin.current?.stop(), []);

  useEffect(() => {
    if (!disabled) return;
    tiltX.set(0);
    tiltY.set(0);
    sheen.set(0);
    lift.set(1);
  }, [disabled, lift, sheen, tiltX, tiltY]);

  useEffect(() => {
    frontFaceRef.current?.toggleAttribute("inert", shown);
    backFaceRef.current?.toggleAttribute("inert", !shown);
  }, [shown]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0 || grip.current) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in some browser environments.
    }
    spin.current?.stop();
    grip.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      base: turn.get(),
      moved: false,
      slop: event.pointerType === "touch" ? SLOP.coarse : SLOP.fine,
      hist: [],
    };
    if (!reduce) lift.set(hoverScale);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const currentGrip = grip.current;
    if (currentGrip && currentGrip.id === event.pointerId) {
      const distance = axis === "x" ? event.clientY - currentGrip.y : event.clientX - currentGrip.x;
      if (!currentGrip.moved) {
        if (Math.abs(distance) < currentGrip.slop || !draggable || reduce) return;
        currentGrip.moved = true;
        setDragging(true);
        tiltX.set(0);
        tiltY.set(0);
        sheen.set(0);
      }
      const span = dragDistance > 0 ? dragDistance : axis === "x" ? height : width;
      const degrees = currentGrip.base + (axis === "x" ? -1 : 1) * (distance / span) * 180;
      turn.set(degrees);
      const now = performance.now();
      currentGrip.hist.push({ t: now, v: degrees });
      while (currentGrip.hist.length > 2 && now - currentGrip.hist[0].t > HISTORY_MS) currentGrip.hist.shift();
      return;
    }

    if (!tilt || reduce || disabled || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const py = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    tiltX.set((0.5 - py) * 2 * tiltMax);
    tiltY.set((px - 0.5) * 2 * tiltMax);
    gx.set(px * 100);
    gy.set(py * 100);
    sheen.set(1);
  };

  const release = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const currentGrip = grip.current;
    if (!currentGrip || currentGrip.id !== event.pointerId) return;
    grip.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in some browser environments.
    }
    setDragging(false);
    if (event.pointerType === "touch" || !rootRef.current?.matches(":hover")) rest();

    if (!currentGrip.moved) {
      if (!cancelled && flipOnClick) flip(false);
      else settle(target.current, 0, false);
      return;
    }

    const here = turn.get();
    let velocity = 0;
    const first = currentGrip.hist[0];
    const last = currentGrip.hist[currentGrip.hist.length - 1];
    if (!cancelled && first && last && last.t > first.t && performance.now() - last.t < 60) {
      velocity = ((last.v - first.v) / (last.t - first.t)) * 1000;
    }
    const destination = cancelled
      ? snap(currentGrip.base)
      : clamp(snap(here + velocity * FLING), snap(here) - 180, snap(here) + 180);
    settle(destination, velocity, false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    if (!event.repeat) flip(true);
  };

  const cardStyle = {
    "--fc-w": width + "px",
    "--fc-h": height + "px",
    "--fc-radius": radius + "px",
    "--fc-bg": background,
    "--fc-ink": color,
    "--fc-shadow": shadowColor,
    "--fc-shadow-o": shadowOpacity,
    "--fc-glare": glareOpacity,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={shown}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={"flip-card" + (className ? " " + className : "")}
      data-axis={axis}
      data-draggable={draggable && !disabled && !reduce ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-fade={reduce ? (shown ? "back" : "front") : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => release(event, false)}
      onPointerCancel={(event) => release(event, true)}
      onLostPointerCapture={(event) => release(event, true)}
      onPointerEnter={(event) => {
        if (!reduce && !disabled && event.pointerType !== "touch") lift.set(hoverScale);
      }}
      onPointerLeave={() => {
        if (!grip.current) rest();
      }}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (!disabled && event.detail === 0) flip(true);
      }}
      onDragStart={(event) => event.preventDefault()}
      style={cardStyle}
    >
      {shadow ? (
        <motion.span
          className="flip-card__shadow"
          aria-hidden="true"
          style={axis === "x" ? { scaleY: spread, opacity: shade } : { scaleX: spread, opacity: shade }}
        />
      ) : null}
      <motion.div
        className="flip-card__rotor"
        style={{
          transform: axis === "x" ? turnX : turnY,
          "--fc-gx": gxPercent,
          "--fc-gy": gyPercent,
          "--fc-sheen": sheen,
        } as MotionStyle}
      >
        <div ref={frontFaceRef} className="flip-card__face flip-card__face--front" aria-hidden={shown}>
          {front}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
        <div ref={backFaceRef} className="flip-card__face flip-card__face--back" aria-hidden={!shown}>
          {back}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
      </motion.div>
    </div>
  );
};

export default FlipCard;
