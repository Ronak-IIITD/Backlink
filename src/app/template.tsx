import { PageFade } from "@/components/motion";

/** Re-mounts on navigation → every route enters with the same quiet fade-rise. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageFade>{children}</PageFade>;
}
