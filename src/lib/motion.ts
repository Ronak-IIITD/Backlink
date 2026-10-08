import type { Transition, Variants } from "motion/react";

/**
 * Motion language — one source of truth.
 *
 * Rules of the system:
 * - Ease-out for entrances (things arriving feel confident), ease-in for exits
 *   (things leaving get out of the way), ease-in-out only for moves between
 *   two known positions (layout changes, tab indicator).
 * - Small distances. Nothing travels far; elements settle, they don't fly.
 * - Durations are short. 120ms for feedback, 200–240ms for interface motion,
 *   500–600ms only for one-time page-entrance choreography.
 * - Springs exist but are nearly critically damped — physical, never bouncy.
 */

/** The signature ease of the product. Fast start, long gentle settle. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
/** For exits and overlays: quick in, confident stop. */
export const easeOutCubic = [0.33, 1, 0.68, 1] as const;
/** Layout moves (tabs, shared elements) — balanced, no drama. */
export const easeInOutCalm = [0.65, 0, 0.35, 1] as const;

export const duration = {
  instant: 0.12,
  fast: 0.2,
  base: 0.24,
  slow: 0.4,
  reveal: 0.6,
} as const;

/** Nearly critically damped spring — physical without bounce. */
export const softSpring: Transition = { type: "spring", stiffness: 380, damping: 38, mass: 1 };

/** Scroll-reveal: a quiet fade-up. Runs once, then never again. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.reveal, ease: easeOutExpo } },
};

/** Staggered children (hero, lists). Each child arrives 60–80ms after the last. */
export const staggerContainer = (stagger = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Child of a stagger group — same quiet fade-up. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base, ease: easeOutExpo } },
};

/** Overlays: backdrop + panel. Exit is quicker than enter (never blocks). */
export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base, ease: easeOutCubic } },
  exit: { opacity: 0, transition: { duration: duration.instant + 0.06, ease: easeOutCubic } },
};

export const panelRise: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: duration.base, ease: easeOutExpo } },
  exit: { opacity: 0, y: 4, scale: 0.99, transition: { duration: duration.instant, ease: easeOutCubic } },
};

export const drawerSlide: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { duration: duration.slow, ease: easeOutExpo } },
  exit: { x: "100%", transition: { duration: duration.base, ease: easeOutCubic } },
};

/** Calm page transition for the app shell (translate+opacity only). */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base, ease: easeOutExpo } },
};

export const reduced = { duration: 0.01 } as const;
