import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DB } from "./types";

// Almacenamiento local de prueba (JSON). Cuando integremos Supabase,
// estas funciones se reemplazan por queries a la base real.

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

export const EMPTY_DB: DB = {
  users: [],
  profiles: [],
  tenants: [],
  staff_members: [],
  services: [],
  service_staff: [],
  business_hours: [],
  clients: [],
  bookings: [],
  subscriptions: [],
  seller_accounts: [],
  payments: [],
};

export function loadDb(): DB {
  if (!existsSync(DATA_FILE)) return structuredClone(EMPTY_DB);
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as DB;
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

export function saveDb(db: DB): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export function nowIso(): string {
  return new Date().toISOString();
}