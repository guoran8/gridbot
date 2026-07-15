import { useEffect, useRef, useState } from "react";

interface MarkPoint {
  i: number;
  mark: number;
}

const MAX_POINTS = 240;

/**
 * Accumulate a rolling in-memory series of the mark price for charting.
 * Sourced from the live snapshot (which the SSE stream keeps fresh), so no
 * extra network traffic — the chart simply samples whatever mark is current.
 */
export function useMarkHistory(botId: string, mark: number): MarkPoint[] {
  const [points, setPoints] = useState<MarkPoint[]>([]);
  const counter = useRef(0);

  // Reset the series when switching to a different bot.
  useEffect(() => {
    setPoints([]);
    counter.current = 0;
  }, [botId]);

  useEffect(() => {
    if (!Number.isFinite(mark) || mark <= 0) return;
    setPoints((prev) => {
      const next = [...prev, { i: counter.current++, mark }];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [mark]);

  return points;
}
