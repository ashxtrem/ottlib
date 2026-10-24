import { transcodeEncoderSchema } from '@ottlib/shared';
import { describe, expect, it } from 'vitest';
import { encoderLabel, transcodeEncoderOptions, transcodeStatusLine } from './transcodeLabels';

describe('transcodeEncoderOptions', () => {
  it('lists every encoder setting, auto first', () => {
    expect(transcodeEncoderOptions.map((option) => option.value)).toEqual(transcodeEncoderSchema.options);
    expect(transcodeEncoderOptions[0].value).toBe('auto');
  });
});

describe('transcodeStatusLine', () => {
  it('names the version, detected encoders and the active one', () => {
    expect(transcodeStatusLine({ available: true, ffmpegVersion: '7.1', encoders: ['nvenc', 'x264'], active: 'nvenc' }))
      .toBe('ffmpeg 7.1 · detected: NVENC, x264 · active: NVENC');
  });

  it('says none when nothing passed the test encode', () => {
    expect(transcodeStatusLine({ available: true, ffmpegVersion: null, encoders: [], active: null }))
      .toBe('ffmpeg (unknown version) · detected: none · active: none');
  });

  it('reports a missing ffmpeg', () => {
    expect(transcodeStatusLine({ available: false, ffmpegVersion: null, encoders: [], active: null })).toBe('ffmpeg not found');
  });

  it('passes unknown encoder ids through', () => {
    expect(encoderLabel('vaapi')).toBe('vaapi');
  });
});
