export function syncCompletionState(partialError: string | null): "succeeded" | "degraded" {
  return partialError ? "degraded" : "succeeded";
}
