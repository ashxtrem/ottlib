import type { TrackMenuItem } from './trackMenuItems';

export type PictureScaling = 'fit' | 'crop' | 'stretch' | 'balanced';

/** The 7 picture modes, same ids, labels and shapes as Android's `PictureMode`. */
export const PICTURE_MODES = [
  { id: 'Fit', label: 'Fit', description: 'Whole picture, black bars where needed', scaling: 'fit', aspectRatio: null },
  { id: 'Zoom', label: 'Zoom', description: 'Fill the screen, trim the edges', scaling: 'crop', aspectRatio: null },
  { id: 'Stretch', label: 'Stretch', description: 'Fill the screen, distort the picture', scaling: 'stretch', aspectRatio: null },
  { id: 'SmartFill', label: 'Smart fill', description: 'Fill the screen: trim a little, stretch a little', scaling: 'balanced', aspectRatio: null },
  { id: 'Wide', label: '16:9', description: 'Force a 16:9 picture', scaling: 'fit', aspectRatio: 16 / 9 },
  { id: 'Standard', label: '4:3', description: 'Force a 4:3 picture', scaling: 'fit', aspectRatio: 4 / 3 },
  { id: 'Cinema', label: '2.39:1', description: 'Force a 2.39:1 (scope) picture', scaling: 'fit', aspectRatio: 2.39 }
] as const satisfies ReadonlyArray<{ id: string; label: string; description: string; scaling: PictureScaling; aspectRatio: number | null }>;

export type PictureModeId = (typeof PICTURE_MODES)[number]['id'];

export const DEFAULT_PICTURE_MODE: PictureModeId = 'Fit';

export function isPictureModeId(value: unknown): value is PictureModeId {
  return PICTURE_MODES.some((mode) => mode.id === value);
}

/** The stored default mode; anything unknown or missing is Fit. */
export function parsePictureDefault(raw: string | null): PictureModeId {
  return isPictureModeId(raw) ? raw : DEFAULT_PICTURE_MODE;
}

/** The stored movieId → mode map; malformed storage or unknown modes are dropped. */
export function parsePictureModes(raw: string | null): Record<string, PictureModeId> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const modes: Record<string, PictureModeId> = {};
    for (const [movieId, mode] of Object.entries(parsed)) if (isPictureModeId(mode)) modes[movieId] = mode;
    return modes;
  } catch {
    return {};
  }
}

/** The mode in force for a title: its own choice, else the device default. */
export function pictureModeFor(modes: Record<string, PictureModeId>, movieId: number, defaultMode: PictureModeId): PictureModeId {
  return modes[String(movieId)] ?? defaultMode;
}

/** The Picture menu: all modes as radio items. */
export function pictureMenuItems(current: PictureModeId): Array<TrackMenuItem & { mode: PictureModeId }> {
  return PICTURE_MODES.map((mode) => ({ key: `picture-${mode.id}`, mode: mode.id, label: mode.label, selected: mode.id === current }));
}
