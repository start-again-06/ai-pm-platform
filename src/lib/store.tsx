import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppData } from "./types";

const STORAGE_KEY = "aipm.data.v1";

export const emptyData: AppData = {
  schemaVersion: 1,
  profile: {
    name: "",
    mission: "",
    vision: "",
    businessModel: "",
    pricing: "",
    targetCustomers: "",
    competitors: "",
    techConstraints: "",
    team: "",
    strategicObjectives: [],
  },
  knowledge: [],
  problems: [],
  opportunities: [],
  roadmap: [],
  prds: [],
  decisions: [],
};

/**
 * Merge stored JSON onto the empty shape. Anything malformed is replaced rather than crashing the app.
 * This is a browser-local store for a single user. A multi-user deployment needs a server database.
 */
export function normaliseData(input: unknown): AppData {
  if (!input || typeof input !== "object") return emptyData;
  const raw = input as Partial<Record<keyof AppData, unknown>>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    schemaVersion: 1,
    profile: {
      ...emptyData.profile,
      ...(typeof raw.profile === "object" && raw.profile ? (raw.profile as object) : {}),
      strategicObjectives: arr<string>((raw.profile as { strategicObjectives?: unknown } | undefined)?.strategicObjectives),
    },
    knowledge: arr(raw.knowledge),
    problems: arr(raw.problems),
    opportunities: arr(raw.opportunities),
    roadmap: arr(raw.roadmap),
    prds: arr(raw.prds),
    decisions: arr(raw.decisions),
  };
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normaliseData(JSON.parse(raw)) : emptyData;
  } catch {
    return emptyData;
  }
}

interface StoreValue {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  replace: (d: AppData) => void;
  reset: () => void;
  storageError: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(null);
    } catch {
      setStorageError("Browser storage is full or unavailable. Export your data from Settings to avoid losing changes.");
    }
  }, [data]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  const replace = useCallback((d: AppData) => setData(normaliseData(d)), []);
  const reset = useCallback(() => setData(emptyData), []);

  const value = useMemo(() => ({ data, update, replace, reset, storageError }), [data, update, replace, reset, storageError]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const nowIso = (): string => new Date().toISOString();

export const daysBetween = (fromIso: string, to: Date = new Date()): number =>
  Math.floor((to.getTime() - new Date(fromIso).getTime()) / (24 * 60 * 60 * 1000));
