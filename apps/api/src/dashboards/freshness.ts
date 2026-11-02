export type FreshnessStatus = "fresh" | "stale" | "never";

export function computeFreshness(
  lastSyncedAt: Date | null | undefined,
  staleAfterHours: number,
  now: Date = new Date(),
): FreshnessStatus {
  if (!lastSyncedAt) return "never";
  const ageMs = now.getTime() - lastSyncedAt.getTime();
  if (ageMs > staleAfterHours * 60 * 60 * 1000) return "stale";
  return "fresh";
}

export function freshnessLabelEs(status: FreshnessStatus): string {
  switch (status) {
    case "fresh":
      return "Fresco";
    case "stale":
      return "Obsoleto";
    case "never":
      return "Sin sincronizar";
  }
}
