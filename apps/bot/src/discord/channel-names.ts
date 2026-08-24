export function normalizeDiscordChannelName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function discordChannelNameMatches(candidate: string, expected: string): boolean {
  return normalizeDiscordChannelName(candidate) === normalizeDiscordChannelName(expected);
}
