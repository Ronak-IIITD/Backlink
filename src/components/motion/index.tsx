"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, animate } from "motion/react";
import { staggerContainer, staggerItem, softSpring, duration, easeOutExpo } from "@/lib/motion";

/* ————— Reduced-motion context (JS side; CSS has its own block) ————— */
const ReducedMotionCtx = createContext(false);
export const useReducedMotionFlag = () => useContext(ReducedMotionCtx);

/* ————— Reveal on scroll (runs once; transform+opacity only) ————— */
export function Reveal({
  children, delay = 0, y = 16, className, as = "div", once = true,
}: {
  children: React.ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" | "span" | "ol" | "ul"; once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "-8% 0px -8% 0px" });
  const reduce = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <Tag
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: duration.reveal, ease: easeOutExpo, delay }}
      viewport={{ once }}
    />
  );
}

/* ————— Stagger group: children declared with <StaggerItem> ————— */
export function Stagger({
  children, className, gap = 0.07, delay = 0, as = "div",
}: { children: React.ReactNode; className?: string; gap?: number; delay?: number; as?: "div" | "ul" | "ol" | "section" }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px -8% 0px" });
  const reduce = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <Tag ref={ref} className={className} initial="hidden" animate={inView ? "visible" : "hidden"} variants={staggerContainer(gap, delay)}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag className={className} variants={staggerItem}>
      {children}
    </Tag>
  );
}

/* ————— Animated number: counts smoothly, then holds ————— */
export function AnimatedNumber({
  value, format, duration: dur, className,
}: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotionFlag();
  const prefersReduce = useReducedMotion();
  const skip = reduce || prefersReduce;
  const [display, setDisplay] = useState(skip ? value : 0);
  const prev = useRef(value);

  useEffect(() => {
    if (skip) { setDisplay(value); return; }
    const controls = animate(prev.current, value, {
      duration: dur ?? (Math.abs(value - prev.current) > 20 ? 0.7 : 0.45),
      ease: easeOutExpo as unknown as [number, number, number, number],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, skip, dur]);

  return <span className={className}>{format ? format(display) : Math.round(display)}</span>;
}

/* ————— Count-up on first view (stats, scores) ————— */
export function CountUp({
  to, className, format, duration: dur = 1,
}: { to: number; className?: string; format?: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();

  return (
    <span ref={ref} className={className}>
      {inView && !reduce ? (
        <AnimatedNumber value={to} format={format} duration={dur} />
      ) : (
        <>{format ? format(to) : to}</>
      )}
    </span>
  );
}

/* ————— Page fade for template.tsx (calm, transform+opacity only) ————— */
export function PageFade({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: easeOutExpo }}
    >
      {children}
    </motion.div>
  );
}

/* ————— Progress bar that fills when visible ————— */
export function AnimatedProgress({
  value, tone = "default", className,
}: { value: number; tone?: "default" | "accent" | "success"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === "accent" ? "bg-indigo-600" : tone === "success" ? "bg-emerald-500" : "bg-slate-900";

  return (
    <div ref={ref} className={"h-1.5 overflow-hidden rounded-full bg-slate-100 " + (className || "")} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={"h-full rounded-full " + color}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: inView || reduce ? pct / 100 : 0 }}
        style={{ width: `${pct}%`, transformOrigin: "left" }}
        transition={{ duration: 0.5, ease: easeOutExpo }}
      />
    </div>
  );
}

/* Score ring that draws itself when visible */
export function AnimatedScoreRing({ score }: { score: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const r = 30, c = 2 * Math.PI * r;
  const color = score >= 80 ? "#059669" : score >= 60 ? "#4f46e5" : "#dc2626";
  const shown = inView || reduce ? score : 0;

  return (
    <div ref={ref} className="relative h-20 w-20 shrink-0" role="img" aria-label={`SEO health ${score} out of 100`}>
      <svg viewBox="0 0 76 76" className="h-20 w-20 -rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="#eef2f7" strokeWidth="7" />
        <motion.circle
          cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * shown) / 100 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: easeOutExpo as unknown as [number, number, number, number] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">
          {inView || reduce ? <AnimatedNumber value={score} /> : 0}
        </span>
      </div>
    </div>
  );
}

/* LayoutId for shared-element transitions (active nav pill, tab indicator) */
export { motion, softSpring };
