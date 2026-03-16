import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export interface JailEntry {
  userId: string;
  reason: string;
  moderatorId: string;
  expiresAt: number | null;
  originalRoles: string[];
  channelId: string;
}

export interface TempBanEntry {
  userId: string;
  reason: string;
  moderatorId: string;
  expiresAt: number;
}

export interface TempKickEntry {
  userId: string;
  reason: string;
  moderatorId: string;
  expiresAt: number;
}

export interface ServerConfig {
  prefix: string;
  logChannelId: string | null;
  jailChannelId: string | null;
  jailRoleId: string | null;
  jails: Record<string, JailEntry>;
  tempBans: Record<string, TempBanEntry>;
  lockedChannels: string[];
}

const defaultConfig = (): ServerConfig => ({
  prefix: "!",
  logChannelId: null,
  jailChannelId: null,
  jailRoleId: null,
  jails: {},
  tempBans: {},
  lockedChannels: [],
});

function getConfigPath(guildId: string): string {
  return path.join(dataDir, `${guildId}.json`);
}

export function loadConfig(guildId: string): ServerConfig {
  const configPath = getConfigPath(guildId);
  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(guildId: string, config: ServerConfig): void {
  const configPath = getConfigPath(guildId);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function updateConfig(
  guildId: string,
  updates: Partial<ServerConfig>
): ServerConfig {
  const config = loadConfig(guildId);
  const updated = { ...config, ...updates };
  saveConfig(guildId, updated);
  return updated;
}
