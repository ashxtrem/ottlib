import { stat } from 'node:fs/promises';

/** Least-recently-used memory of keyframe lists, keyed by path + mtime so an edited file is read again. */
export class KeyframeCache {
  private readonly entries = new Map<string, number[] | null>();

  public constructor(private readonly capacity: number) {}

  public async getOrRead(path: string, read: () => Promise<number[] | null>): Promise<number[] | null> {
    const { mtimeMs, size } = await stat(path);
    const key = `${path}\u0000${mtimeMs}\u0000${size}`;
    if (this.entries.has(key)) {
      const hit = this.entries.get(key) ?? null;
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit;
    }
    const value = await read();
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value as string);
    return value;
  }

  public get size(): number {
    return this.entries.size;
  }
}
