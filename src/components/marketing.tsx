"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Reveal } from "@/components/motion";

export function AuthLayout({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_440px]">
      <div className="hidden border-r border-slate-200 bg-slate-50/70 p-10 md:block">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-bold text-white">S</span>
          SEO Agent
        </Link>
        <Reveal delay={0.1}>
          <h2 className="mt-14 max-w-sm text-[28px] font-semibold leading-tight tracking-tight">Your SEO employee starts with one audit.</h2>
        </Reveal>
        <Reveal as="ol" delay={0.2} className="mt-6 space-y-3 text-sm [&>li]:flex [&>li]:gap-3">
          {["Connect", "Analyze", "Approve"].map((t, i) => (
            <li key={t}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{i + 1}</span>
              <div><b>{t}.</b> <span className="text-slate-600">{[["Connect", "Enter your URL — isolated project, SSRF-checked."], ["Analyze", "30 pages, 19 checks, transparent score."], ["Approve", "Review drafted fixes. Apply only what you choose."]][i][1]}</span></div>
            </li>
          ))}
        </Reveal>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm fade">
          <h1 className="page-title">{title}</h1>
          <p className="body mt-1.5">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function MarketingNav({ links }: { links?: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const items = links || [
    { href: "/#product", label: "Product" },
    { href: "/#how", label: "How it works" },
    { href: "/pricing", label: "Pricing" },
    { href: "/help", label: "Help" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto max-w-[1120px] px-5">
        <div className="flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80" aria-label="SEO Agent home">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-bold text-white">S</span>
          SEO Agent
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-slate-500 md:flex" aria-label="Product">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="transition-colors duration-150 hover:text-slate-900">{it.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">Get started</Link>
          <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="marketing-mobile-nav" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        </div>
        {open && <nav id="marketing-mobile-nav" className="border-t border-slate-200 py-2 md:hidden" aria-label="Product">
          {items.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-md px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900">{item.label}</Link>)}
        </nav>}
      </div>
    </header>
  );
}
