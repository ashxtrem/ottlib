import { torrentPreferredCodecSchema, torrentPreferredResolutionSchema, type UpdateSettings } from '@ottlib/shared';

export const torrentResolutionOptions = torrentPreferredResolutionSchema.options;
export const torrentCodecOptions = torrentPreferredCodecSchema.options;

type TorrentPreferencesUpdate = Pick<UpdateSettings, 'torrentPreferredResolution' | 'torrentPreferredCodec' | 'torrentMaxSizeGb'>;

/** Reads the three release preferences from the settings form; an empty or invalid field means "no preference" (null). */
export function torrentPreferencesUpdate(values: FormData): TorrentPreferencesUpdate {
  const resolution = torrentPreferredResolutionSchema.safeParse(values.get('torrentPreferredResolution'));
  const codec = torrentPreferredCodecSchema.safeParse(values.get('torrentPreferredCodec'));
  const size = Number(String(values.get('torrentMaxSizeGb') ?? '').trim());
  return {
    torrentPreferredResolution: resolution.success ? resolution.data : null,
    torrentPreferredCodec: codec.success ? codec.data : null,
    torrentMaxSizeGb: Number.isFinite(size) && size > 0 && size <= 10_000 ? size : null
  };
}
