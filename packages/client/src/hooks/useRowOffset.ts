import { useEffect, useLayoutEffect, type RefObject } from 'react';

/** sessionStorage key holding each home row's sideways scroll, by row key. */
export const rowOffsetsStorageKey = 'ottlib-home-row-offsets';

type Offsets = Record<string, number>;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): StorageLike | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}

export function readRowOffsets(storage: StorageLike | undefined = sessionStore()): Offsets {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(rowOffsetsStorageKey) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0));
  } catch {
    return {};
  }
}

export function writeRowOffset(rowKey: string, offset: number, storage: StorageLike | undefined = sessionStore()): void {
  try {
    const offsets = readRowOffsets(storage);
    if (offset > 0) offsets[rowKey] = Math.round(offset); else delete offsets[rowKey];
    storage?.setItem(rowOffsetsStorageKey, JSON.stringify(offsets));
  } catch { /* storage full or blocked: losing the sideways position is fine */ }
}

export function clearRowOffsets(storage: StorageLike | undefined = sessionStore()): void {
  try { storage?.removeItem(rowOffsetsStorageKey); } catch { /* blocked storage */ }
}

/** Keeps a row's sideways scroll in sessionStorage and, when `restore` is set, puts it back on mount. */
export function useRowOffset(listRef: RefObject<HTMLElement | null>, rowKey: string, restore: boolean): void {
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!restore || !el) return;
    const offset = readRowOffsets()[rowKey];
    if (offset) el.scrollLeft = offset;
    // Only when the row mounts: later renders must not pull the row back.
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let timer: number | undefined;
    let latest = el.scrollLeft;
    const flush = () => { timer = undefined; writeRowOffset(rowKey, latest); };
    const save = () => {
      latest = el.scrollLeft;
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 150);
    };
    el.addEventListener('scroll', save, { passive: true });
    return () => {
      el.removeEventListener('scroll', save);
      if (timer !== undefined) { window.clearTimeout(timer); flush(); }
    };
  }, [listRef, rowKey]);
}
