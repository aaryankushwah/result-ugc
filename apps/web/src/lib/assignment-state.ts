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
}: {
  pending: boolean;
  queued: boolean;
}): string {
  if (pending) return "Connecting…";
  return queued ? "Connection queued" : "Connect Discord";
}
