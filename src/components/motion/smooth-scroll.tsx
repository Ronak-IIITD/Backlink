"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Lenis from "lenis";

/**
 * Weighted, fluid scrolling via Lenis.
 * - Skipped for reduced-motion users (native scrolling is instant and theirs).
 * - Skipped on touch devices where native momentum already feels right.
 * - Re-syncs after route changes so anchors and positions land correctly.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      // Matches the product's signature ease-out-expo settle.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });

    let frame: number;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    // Anchor links should glide, not jump.
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute("href")!.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -72, duration: 1.1 });
    };
    document.addEventListener("click", onClick);

    // Let programmatic callers (e.g. settings sidebar) glide through Lenis.
    const onScrollTo = (e: Event) => {
      const detail = (e as CustomEvent).detail as { selector?: string; offset?: number } | undefined;
      const el = detail?.selector ? document.querySelector(detail.selector) : null;
      if (el) lenis.scrollTo(el as HTMLElement, { offset: detail?.offset ?? -16, duration: 0.8 });
    };
    window.addEventListener("lenis:scroll-to", onScrollTo);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      window.removeEventListener("lenis:scroll-to", onScrollTo);
      lenis.destroy();
    };
  }, []);

  // New route → scroll to top immediately so the page fade starts at rest.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, search]);

  return null;
}
