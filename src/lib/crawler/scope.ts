import psl from "psl";
export function sameSite(a: string, b: string): boolean {
  try {
    const host = (value: string) => {
      const name = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
      return psl.get(name) || name;
    };
    return host(a) === host(b);
  } catch { return false; }
}
