/**
 * Posts complete, then moves on only if it worked. When it fails, `onFail` runs and `proceed` does not: the viewer stays
 * on the player (the title is not marked watched, and progress reports carry on). Resolves true when it proceeded.
 */
export async function completeThen(complete: () => Promise<void>, proceed: () => void, onFail: () => void): Promise<boolean> {
  try {
    await complete();
  } catch {
    onFail();
    return false;
  }
  proceed();
  return true;
}
