export function accountAssignmentLabel({
  pending,
  confirmed,
  suggested,
  assigned,
}: {
  pending: boolean;
  confirmed: boolean;
  suggested: boolean;
  assigned: boolean;
}): string {
  if (pending) return "Saving…";
  if (confirmed) return "Assigned";
  if (suggested) return "Confirm";
  return assigned ? "Reassign" : "Assign";
}

export function discordConnectionLabel({
  pending,
  queued,
  linked = false,
}: {
  pending: boolean;
  queued: boolean;
  linked?: boolean;
}): string {
  if (pending) return "Connecting…";
  if (queued) return "Connection queued";
  return linked ? "Change Discord member" : "Connect Discord";
}
