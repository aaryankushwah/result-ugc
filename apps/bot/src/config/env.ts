import "dotenv/config";

export interface Env {
  token: string;
  clientId: string;
  guildId?: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function loadEnv(): Env {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  return {
    token: required("DISCORD_TOKEN"),
    clientId: required("DISCORD_CLIENT_ID"),
    ...(guildId ? { guildId } : {}),
  };
}
