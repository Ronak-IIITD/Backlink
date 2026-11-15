"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Menu, X } from "lucide-react";
import { Brand } from "./brand";

export function AuthLayout({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-forest p-12 text-white lg:flex xl:p-16">
        <Link href="/" aria-label="SEO Agent home">
          <Brand />
        </Link>
        <div className="relative z-10 my-16 max-w-lg">
          <p className="text-xs font-medium uppercase tracking-[.18em] text-[#c4d8bd]">
            Small steps. Stronger foundations.
          </p>
          <h2 className="display mt-5 text-6xl xl:text-7xl">
            Make room
            <br />
            for growth.
          </h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-[#d2dfce]">
            A clearer picture of your website. A practical plan to improve it.
            And you in control of every change.
          </p>
          <ol className="mt-10 space-y-5">
            {[
              [
                "Start with your website",
                "One audit of up to 30 public pages.",
              ],
              [
                "Find your next step",
                "Prioritized issues with the evidence attached.",
              ],
              [
                "Review every change",
                "Approve a draft, apply it, and check it again.",
              ],
            ].map(([heading, body], i) => (
              <li key={heading} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/25 text-xs">
                  0{i + 1}
                </span>
                <span>
                  <span className="block text-sm font-medium">{heading}</span>
                  <span className="mt-1 block text-sm text-[#c4d8bd]">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-[#c4d8bd]">
          Private pilot · Built for small businesses
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-44 -right-40 h-[500px] w-[500px] rounded-full border border-white/10 p-12"
        >
          <div className="h-full w-full rounded-full border border-white/10 p-12">
            <div className="h-full w-full rounded-full border border-white/10" />
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-col px-6 py-7 sm:px-12">
        <Link
          href="/"
          className="self-start text-sm text-slate-500 hover:text-forest"
        >
          <span className="lg:hidden">
            <Brand />
          </span>
          <span className="hidden items-center gap-2 lg:inline-flex">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </span>
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <p className="eyebrow mb-4 text-indigo-700">Your SEO workspace</p>
          <h1 className="page-title">{title}</h1>
          <p className="body mt-3">{sub}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Check className="h-3.5 w-3.5" /> Every website change stays in your
          hands.
        </p>
      </main>
    </div>
  );
}

export function MarketingNav({
  links,
}: {
  links?: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const items = links || [
    { href: "/#product", label: "The product" },
    { href: "/#how", label: "How it works" },
    { href: "/pricing", label: "Pricing" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="flex h-[76px] items-center justify-between gap-4">
          <Link href="/" aria-label="SEO Agent home">
            <Brand />
          </Link>
          <nav
            className="hidden items-center gap-8 text-[13px] text-slate-600 md:flex"
            aria-label="Product"
          >
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={pathname === it.href ? "page" : undefined}
                className="transition-colors hover:text-forest"
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="text-[13px] font-medium text-slate-600 hover:text-forest"
            >
              Log in
            </Link>
            <Link
              href="/pricing"
              className="btn btn-primary btn-sm hidden sm:inline-flex"
            >
              Join the pilot <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="marketing-mobile-nav"
              className="rounded-lg border border-slate-200 p-2 md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="marketing-mobile-nav"
            className="border-t border-slate-200 pb-4 pt-2 md:hidden"
            aria-label="Product"
          >
            {[
              ...items,
              { href: "/pricing", label: "Join the private pilot" },
            ].map((it) => (
              <Link
                key={it.label}
                href={it.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
                {it.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
