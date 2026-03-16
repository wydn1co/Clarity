import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export interface WarnEntry {
  id: number;
  reason: string;
  moderatorId: string;
  timestamp: number;
}

type WarnStore = Record<string, WarnEntry[]>;

function getWarnsPath(guildId: string): string {
  return path.join(dataDir, `${guildId}-warns.json`);
}

export function loadWarns(guildId: string): WarnStore {
  const p = getWarnsPath(guildId);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

export function saveWarns(guildId: string, store: WarnStore): void {
  fs.writeFileSync(getWarnsPath(guildId), JSON.stringify(store, null, 2), "utf-8");
}

export function addWarn(
  guildId: string,
  userId: string,
  entry: Omit<WarnEntry, "id">
): WarnEntry[] {
  const store = loadWarns(guildId);
  if (!store[userId]) store[userId] = [];
  const id = store[userId].length + 1;
  store[userId].push({ id, ...entry });
  saveWarns(guildId, store);
  return store[userId];
}

export function getUserWarns(guildId: string, userId: string): WarnEntry[] {
  const store = loadWarns(guildId);
  return store[userId] ?? [];
}

export function removeWarn(guildId: string, userId: string, warnId: number): boolean {
  const store = loadWarns(guildId);
  if (!store[userId]) return false;
  const idx = store[userId].findIndex((w) => w.id === warnId);
  if (idx === -1) return false;
  store[userId].splice(idx, 1);
  saveWarns(guildId, store);
  return true;
}

export function clearWarns(guildId: string, userId: string): number {
  const store = loadWarns(guildId);
  const count = store[userId]?.length ?? 0;
  delete store[userId];
  saveWarns(guildId, store);
  return count;
}
