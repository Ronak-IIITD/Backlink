import { Sprout } from "lucide-react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="brand-mark h-9 w-9">
        <Sprout className="h-5 w-5" strokeWidth={1.7} aria-hidden />
      </span>
      {!compact && (
        <span className="whitespace-nowrap text-[17px] font-semibold tracking-tight">
          SEO Agent<span className="ml-1 text-indigo-600">.</span>
        </span>
      )}
    </span>
  );
}
