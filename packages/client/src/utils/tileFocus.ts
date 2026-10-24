/** Arrow/Home/End movement across a wrapping grid of tiles, for keyboards and TV remotes (D-pad sends arrow keys). */
export function nextTileIndex(index: number, key: string, count: number, columns: number): number | null {
  if (count === 0) return null;
  const cols = Math.max(1, columns);
  const target = key === 'ArrowLeft' ? index - 1
    : key === 'ArrowRight' ? index + 1
      : key === 'ArrowUp' ? index - cols
        : key === 'ArrowDown' ? Math.min(index + cols, count - 1)
          : key === 'Home' ? 0
            : key === 'End' ? count - 1
              : null;
  if (target === null || target < 0 || target >= count || target === index) return null;
  // Down from a row above a shorter last row lands on that row's last tile; never past it.
  if (key === 'ArrowDown' && Math.floor(target / cols) === Math.floor(index / cols)) return null;
  return target;
}

/** Tiles sharing the first tile's top edge form one row. */
export function columnsFromTops(tops: number[]): number {
  if (tops.length === 0) return 1;
  return Math.max(1, tops.filter((top) => Math.abs(top - tops[0]) < 2).length);
}

/** Focus the profile used last on this browser, else the first tile. */
export function initialTileIndex(ids: number[], lastId: number | null): number {
  const index = lastId === null ? -1 : ids.indexOf(lastId);
  return index >= 0 ? index : 0;
}
