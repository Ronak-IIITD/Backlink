"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, AlertTriangle, Bot, FileText, KeyRound, Users, Link2,
  BarChart3, Settings, LogOut, ChevronsUpDown, Search, LifeBuoy, FolderKanban, Check,
  Building2,
} from "lucide-react";
import { clsx } from "clsx";
import { Modal, toast, ToastHost } from "./ui";
import { AnimatePresence, motion } from "motion/react";
import { overlayFade, panelRise, staggerContainer, staggerItem } from "@/lib/motion";
import { preferredProject, rememberProject } from "@/lib/project-selection";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/issues", label: "Issues", icon: AlertTriangle },
  { href: "/agent", label: "AI Agent", icon: Bot },
  { href: "/content", label: "Content", icon: FileText },
  { href: "/keywords", label: "Keywords", icon: KeyRound },
  { href: "/competitors", label: "Competitors", icon: Users },
  { href: "/backlinks", label: "Backlinks", icon: Link2 },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/agency", label: "Agency", icon: Building2 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => {
      if (!j.ok) return;
      setProjects(j.data);
      const routeId = path.match(/^\/projects\/([^/]+)/)?.[1];
      const selected = routeId ? j.data.find((p: any) => p.id === routeId) : preferredProject(j.data);
      if (selected) { setActiveId(selected.id); rememberProject(selected.id); }
    }).catch(() => {});
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setMe(j.data?.user)).catch(() => {});
  }, [path]);

  // Cmd+K command menu
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const currentId = path.match(/^\/projects\/([^/]+)/)?.[1];
  const current = projects.find((p) => p.id === currentId) || projects.find((p) => p.id === activeId) || preferredProject(projects);

  function selectProject(id: string) {
    setActiveId(id);
    rememberProject(id);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-auto px-2.5" aria-label="Primary">
      {NAV.map((n) => {
        const active = path === n.href || (n.href !== "/dashboard" && path.startsWith(n.href));
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setMobileOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[14px] transition-colors duration-150",
              active ? "font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active-pill"
                className="absolute inset-0 rounded-lg bg-slate-100"
                transition={{ type: "spring", stiffness: 480, damping: 44 }}
              />
            )}
            <n.icon className="relative h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="relative">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="p-3">
          <button
            onClick={() => setSwitchOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300"
            aria-label="Switch project"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-semibold text-white">
              {(current?.name || "S")?.[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold leading-tight">{current?.name || "Select site"}</span>
              <span className="block truncate text-xs text-slate-500">{current ? hostOf(current.websiteUrl) : "No projects yet"}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        </div>
        {nav}
        <div className="space-y-0.5 p-2.5">
          <SideLink href="/projects" icon={<FolderKanban className="h-4 w-4" strokeWidth={1.75} />} label="All projects" active={path === "/projects"} />
          <SideLink href="/settings" icon={<Settings className="h-4 w-4" strokeWidth={1.75} />} label="Settings" active={path === "/settings"} />
          <SideLink href="/help" icon={<LifeBuoy className="h-4 w-4" strokeWidth={1.75} />} label="Help" active={path === "/help"} />
        </div>
        <div className="border-t border-slate-200 p-3">
          <button onClick={() => setCmdOpen(true)} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700">
            <Search className="h-3.5 w-3.5" aria-hidden /> Search or jump to…
            <kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-400">⌘K</kbd>
          </button>
          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600" aria-hidden>
              {(me?.email || "?")[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">{me?.email || ""}</span>
            <button onClick={logout} aria-label="Log out" className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium">Menu</button>
          <span className="truncate text-sm font-semibold">{current?.name || "SEO Agent"}</span>
          <button onClick={() => setCmdOpen(true)} aria-label="Search" className="ml-auto rounded-lg border border-slate-200 p-1.5"><Search className="h-4 w-4" /></button>
        </header>
        <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <motion.div
              className="absolute inset-0 bg-slate-950/40"
              variants={overlayFade} initial="hidden" animate="visible" exit="exit"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: "transform" }}
            >
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <span className="font-semibold">SEO Agent</span>
                <button onClick={() => setMobileOpen(false)} className="rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100">Close</button>
              </div>
              <div className="py-3">{nav}</div>
              <div className="mt-auto border-t border-slate-200 p-3">
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"><LogOut className="h-4 w-4" /> Log out</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ProjectSwitcher open={switchOpen} onClose={() => setSwitchOpen(false)} projects={projects} currentId={current?.id} onSelect={selectProject} />
      <CommandMenu open={cmdOpen} onClose={() => setCmdOpen(false)} projects={projects} />
      <ToastHost />
    </div>
  );
}

function SideLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={clsx("flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[14px]", active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")}>
      {icon}{label}
    </Link>
  );
}

function hostOf(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function ProjectSwitcher({ open, onClose, projects, currentId, onSelect }: { open: boolean; onClose: () => void; projects: any[]; currentId?: string; onSelect: (id: string) => void }) {
  const router = useRouter();
  return (
    <Modal open={open} onClose={onClose} title="Switch site">
      <div className="space-y-1.5">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose(); router.push(`/projects/${p.id}`); }}
            className={clsx("flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition", p.id === currentId ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">{(p.name || "S")[0].toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.name}</span>
              <span className="block truncate text-[13px] text-slate-500">{hostOf(p.websiteUrl)}</span>
            </span>
            {p.id === currentId && <Check className="h-4 w-4 text-slate-900" aria-hidden />}
          </button>
        ))}
        {!projects.length && <p className="body">No sites yet — create your first project to start an audit.</p>}
        <Link href="/projects" onClick={onClose} className="btn btn-secondary btn-md mt-2 w-full">New site audit</Link>
      </div>
    </Modal>
  );
}

function CommandMenu({ open, onClose, projects }: { open: boolean; onClose: () => void; projects: any[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  useEffect(() => { if (open) setQ(""); }, [open ]);
  if (!open) return null;
  const items = [
    ...NAV_FILTER.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).map((n) => ({ type: "Go to " + n.label, label: n.label, href: n.href })),
    ...projects.filter((p) => (p.name + p.websiteUrl).toLowerCase().includes(q.toLowerCase())).map((p) => ({ type: "Open site", label: `${p.name} — ${hostOf(p.websiteUrl)}`, href: `/projects/${p.id}` })),
    { type: "Action", label: "Run audit on current site", href: "__audit" },
    { type: "Action", label: "Review AI fixes", href: "/agent" },
  ].slice(0, 9);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Command menu">
          <motion.div
            className="absolute inset-0 bg-slate-950/40"
            variants={overlayFade} initial="hidden" animate="visible" exit="exit"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            variants={panelRise} initial="hidden" animate="visible" exit="exit"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-4">
              <Search className="h-4 w-4 text-slate-400" aria-hidden />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command or search sites…" className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400" aria-label="Command search" />
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">esc</kbd>
            </div>
            <motion.div className="max-h-72 overflow-auto p-1.5" variants={staggerContainer(0.03)} initial="hidden" animate="visible">
              {items.map((it, i) => (
                <motion.button
                  key={i}
                  variants={staggerItem}
                  onClick={() => {
                    onClose();
                    if (it.href === "__audit") { toast("Audit controls live on the project page", "Open your site to start or watch a scan."); return; }
                    router.push(it.href);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-slate-100"
                >
                  <span className="w-20 shrink-0 text-xs text-slate-400">{it.type}</span>
                  <span className="truncate font-medium">{it.label}</span>
                </motion.button>
              ))}
              {!items.length && <div className="px-3 py-6 text-center text-sm text-slate-500">No matches.</div>}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const NAV_FILTER = [
  { label: "Overview", href: "/dashboard" },
  { label: "Issues", href: "/issues" },
  { label: "AI Agent", href: "/agent" },
  { label: "Content", href: "/content" },
  { label: "Keywords", href: "/keywords" },
  { label: "Competitors", href: "/competitors" },
  { label: "Backlinks", href: "/backlinks" },
  { label: "Reports", href: "/reports" },
  { label: "Agency", href: "/agency" },
  { label: "Settings", href: "/settings" },
];

/* Back-compat exports used by older pages during migration */
export function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#059669" : score >= 60 ? "#4f46e5" : "#dc2626";
  return (
    <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`SEO health ${score} out of 100`}>
      <svg viewBox="0 0 76 76" className="h-20 w-20 -rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="#eef2f7" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-semibold tabular-nums">{score}</span></div>
    </div>
  );
}
export function SevBadge({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-amber-50 text-amber-800 border-amber-200",
    low: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${map[sev] || map.low}`}>{sev}</span>;
}
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="card p-10 text-center"><div className="text-[15px] font-semibold">{title}</div>{hint && <p className="body mx-auto mt-1 max-w-sm">{hint}</p>}</div>;
}
export function Loading({ label }: { label?: string }) {
  return <div className="card p-5" aria-busy="true"><div className="space-y-2.5"><div className="skeleton h-3.5 w-1/3" /><div className="skeleton h-3.5 w-full" /><div className="skeleton h-3.5 w-2/3" /></div>{label && <div className="mt-3 text-[13px] text-slate-500">{label}</div>}</div>;
}
