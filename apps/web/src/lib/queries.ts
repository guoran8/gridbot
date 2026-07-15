import type { BotAction, GridConfig } from "@gridbot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";

export const botsKey = ["bots"] as const;
export const ordersKey = (id: string) => ["orders", id] as const;
export const fillsKey = (id: string) => ["fills", id] as const;
export const logsKey = ["logs"] as const;

export function useBots() {
  return useQuery({ queryKey: botsKey, queryFn: api.listBots });
}

export function useOrders(id: string) {
  return useQuery({
    queryKey: ordersKey(id),
    queryFn: () => api.listOrders(id),
    refetchInterval: 3000,
  });
}

export function useFills(id: string) {
  return useQuery({
    queryKey: fillsKey(id),
    queryFn: () => api.listFills(id),
    refetchInterval: 3000,
  });
}

export function useLogs() {
  return useQuery({ queryKey: logsKey, queryFn: api.listLogs, refetchInterval: 4000 });
}

export function useCreateBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: GridConfig) => api.createBot(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: botsKey }),
  });
}

export function useControlBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: BotAction }) => api.control(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: botsKey }),
  });
}

export function useDeleteBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteBot(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: botsKey }),
  });
}

export function useAdjustRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      band,
    }: {
      id: string;
      band: { lowerPrice: number; upperPrice: number; gridCount: number };
    }) => api.adjustRange(id, band),
    onSuccess: () => qc.invalidateQueries({ queryKey: botsKey }),
  });
}

export function useAiStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: api.aiStatus, staleTime: 60_000 });
}

export function useAdvise() {
  return useMutation({
    mutationFn: (input: { symbol: string; markPrice: number; closes?: number[] }) =>
      api.advise(input),
  });
}

export function useVenues() {
  return useQuery({ queryKey: ["venues"], queryFn: api.listVenues, staleTime: 30_000 });
}

export function useProbeVenue() {
  return useMutation({
    mutationFn: ({ id, symbol }: { id: string; symbol?: string }) => api.probeVenue(id, symbol),
  });
}
