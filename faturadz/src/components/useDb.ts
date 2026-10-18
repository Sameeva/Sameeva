"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type FaturaDb } from "@/db";

/**
 * Live query on the local database. Returns `undefined` while loading,
 * then the query result (re-rendered when the data changes).
 */
export function useDbQuery<T>(query: (db: FaturaDb) => Promise<T> | T, deps: unknown[] = []): T | undefined {
  return useLiveQuery(() => query(getDb()), deps);
}
