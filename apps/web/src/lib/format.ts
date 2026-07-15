export function fmtUsd(n: number, digits = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtNum(n: number, digits = 4): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

/** Tailwind text-color class for a signed value. */
export function pnlColor(n: number): string {
  if (n > 0) return "text-emerald-500";
  if (n < 0) return "text-red-500";
  return "text-muted-foreground";
}
