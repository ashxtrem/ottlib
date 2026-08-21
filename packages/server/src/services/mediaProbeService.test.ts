import { describe, expect, it } from 'vitest';
import { extractProbedMedia } from './mediaProbeService.js';

describe('extractProbedMedia', () => {
  it('normalizes video, audio, and subtitle streams from ffprobe output', () => {
    const result = extractProbedMedia({
      format: { format_name: 'matroska,webm', duration: '7260.123' },
      streams: [
        { index: 0, codec_type: 'video', codec_name: 'hevc', profile: 'Main 10', width: 3840, height: 2160, bit_rate: '19000000', color_transfer: 'smpte2084', side_data_list: [{ side_data_type: 'DOVI configuration record' }] },
        { index: 1, codec_type: 'audio', codec_name: 'eac3', channels: 6, channel_layout: '5.1(side)', tags: { language: 'eng', title: 'Dolby Atmos' }, disposition: { default: 1 } },
        { index: 2, codec_type: 'subtitle', codec_name: 'subrip', tags: { language: 'hin' }, disposition: { forced: 1 } }
      ]
    });

    expect(result.mediaInfo).toEqual({
      container: 'MKV', durationMs: 7_260_123, width: 3840, height: 2160, videoCodec: 'HEVC', videoProfile: 'Main 10', videoBitRate: 19_000_000, hdrFormat: 'Dolby Vision'
    });
    expect(result.tracks).toEqual([
      { type: 'audio', source: 'embedded', order: 1, language: 'eng', title: 'Dolby Atmos', codec: 'E-AC-3', channels: 6, channelLayout: '5.1(side)', isDefault: true, isForced: false, isHearingImpaired: false },
      { type: 'subtitle', source: 'embedded', order: 2, language: 'hin', title: null, codec: 'SRT', channels: null, channelLayout: null, isDefault: false, isForced: true, isHearingImpaired: false }
    ]);
  });
});
