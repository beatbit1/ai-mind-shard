export const ROOTS_PREFIX = "tonara.mnemos.roots.";
export const RECORDS_PREFIX = "tonara.mnemos.records.";

export type MemoryRecordRef = {
  rootHash: string;
  txHash?: string;
  role?: "user" | "assistant";
  sessionId?: string;
  ts?: number;
  sizeBytes?: number;
  source?: "mnemos" | "atlas";
};

export function getMemoryRoots(wallet: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(ROOTS_PREFIX + wallet) ?? "[]");
  } catch {
    return [];
  }
}

export function getMemoryRecordRefs(wallet: string): MemoryRecordRef[] {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_PREFIX + wallet) ?? "[]");
  } catch {
    return [];
  }
}

export function appendMemoryRecord(wallet: string, record: MemoryRecordRef) {
  const roots = getMemoryRoots(wallet).filter((root) => root !== record.rootHash);
  roots.push(record.rootHash);
  localStorage.setItem(ROOTS_PREFIX + wallet, JSON.stringify(roots.slice(-100)));

  const records = getMemoryRecordRefs(wallet).filter((r) => r.rootHash !== record.rootHash);
  records.push(record);
  localStorage.setItem(RECORDS_PREFIX + wallet, JSON.stringify(records.slice(-100)));
}