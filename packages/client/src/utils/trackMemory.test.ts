import { describe, expect, it } from 'vitest';
import type { AudioTrackSource, BurnInSubtitle, PlaybackSource, SubtitleSource } from '@ottlib/shared';
import { languageKey, parseTrackChoices, parseTrackLanguages, pickAudioOrder, pickSubtitle, recordTrackChoice, rememberedLanguages, rememberedStart, sameLanguage } from './trackMemory';

const audio = (order: number, language: string | null, isDefault = false): AudioTrackSource => ({ order, language, title: null, codec: 'aac', channels: 2, isDefault });
const text = (url: string, language: string | null, isForced = false): SubtitleSource => ({ url, language, codec: 'WEBVTT', title: null, isForced, isHearingImpaired: false });
const image = (order: number, language: string | null): BurnInSubtitle => ({ order, language, title: null, codec: 'pgs', isForced: false });

const source = (extra: Partial<PlaybackSource>): PlaybackSource => ({
  kind: 'direct', streamUrl: '/api/stream/1', mimeType: 'video/mp4', durationMs: 1000, resumePositionMs: null,
  audioTracks: [audio(1, 'eng', true), audio(2, 'hin')],
  subtitles: [text('/en.vtt', 'eng'), text('/hi-forced.vtt', 'hi', true), text('/hi.vtt', 'hin')],
  burnInSubtitles: [image(5, 'fre')],
  ...extra
} as PlaybackSource);

describe('languages', () => {
  it('treats two- and three-letter codes and regions as one language', () => {
    expect(sameLanguage('eng', 'en')).toBe(true);
    expect(sameLanguage('fre', 'fr-CA')).toBe(true);
    expect(sameLanguage('ger', 'deu')).toBe(true);
    expect(sameLanguage('en', 'hi')).toBe(false);
    expect(sameLanguage(null, null)).toBe(false);
    expect(languageKey('und')).toBeNull();
  });
});

describe('rememberedLanguages', () => {
  const last = { audio: 'jpn', subtitle: 'en' };
  it('uses the title\'s own choice first, then the last-chosen languages, per field', () => {
    expect(rememberedLanguages({ 7: { audio: 'hin', subtitle: null } }, 7, last)).toEqual({ audio: 'hin', subtitle: null });
    expect(rememberedLanguages({ 7: { audio: 'hin' } }, 7, last)).toEqual({ audio: 'hin', subtitle: 'en' });
    expect(rememberedLanguages({ 7: { audio: 'hin' } }, 8, last)).toEqual(last);
    expect(rememberedLanguages({}, 8, {})).toEqual({});
  });

  it('records picks per title, capped by dropping the lowest other ids', () => {
    let choices = recordTrackChoice({}, 1, { audio: 'eng' });
    choices = recordTrackChoice(choices, 2, { subtitle: 'fr' });
    choices = recordTrackChoice(choices, 1, { subtitle: null });
    expect(choices).toEqual({ 1: { audio: 'eng', subtitle: null }, 2: { subtitle: 'fr' } });
    expect(Object.keys(recordTrackChoice(choices, 3, { audio: 'hin' }, 2))).toEqual(['2', '3']);
    // The title just picked always stays, even with the lowest id.
    expect(Object.keys(recordTrackChoice(choices, 0, { audio: 'hin' }, 2))).toEqual(['0', '2']);
  });

  it('survives corrupt stored values', () => {
    expect(parseTrackChoices('not json')).toEqual({});
    expect(parseTrackChoices('[1]')).toEqual({});
    expect(parseTrackChoices('{"4":{"audio":"en","subtitle":7},"x":{"audio":"en"}}')).toEqual({ 4: { audio: 'en' } });
    expect(parseTrackLanguages(null)).toEqual({});
    expect(parseTrackLanguages('{"subtitle":null}')).toEqual({ subtitle: null });
  });
});

describe('picks', () => {
  it('picks the audio track in the remembered language, and nothing for an unknown one', () => {
    expect(pickAudioOrder([audio(1, 'eng'), audio(2, 'hin'), audio(3, 'hi', true)], 'hi')).toBe(3);
    expect(pickAudioOrder([audio(1, 'eng'), audio(2, 'hin')], 'hi')).toBe(2);
    expect(pickAudioOrder([audio(1, 'eng')], 'kor')).toBeUndefined();
    expect(pickAudioOrder([audio(1, 'eng')], undefined)).toBeUndefined();
  });

  it('prefers a full text subtitle, then a burned-in one; off or unknown keeps the default', () => {
    const tracks = source({}).subtitles ?? [];
    expect(pickSubtitle(tracks, [image(5, 'fre')], 'hi')).toEqual({ kind: 'text', url: '/hi.vtt' });
    expect(pickSubtitle(tracks, [image(5, 'fre')], 'fr')).toEqual({ kind: 'burn', order: 5 });
    expect(pickSubtitle(tracks, [], 'kor')).toBeNull();
    expect(pickSubtitle(tracks, [], null)).toBeNull();
  });
});

describe('rememberedStart', () => {
  it('changes nothing without memory or when the first answer already fits', () => {
    expect(rememberedStart(source({}), {})).toEqual({ text: null, change: null });
    expect(rememberedStart(source({}), { audio: 'en', subtitle: null })).toEqual({ text: null, change: null });
    expect(rememberedStart(source({}), { audio: 'kor', subtitle: 'kor' })).toEqual({ text: null, change: null });
  });

  it('asks again for the remembered audio and shows the remembered text subtitle', () => {
    expect(rememberedStart(source({}), { audio: 'hi', subtitle: 'en' })).toEqual({ text: '/en.vtt', change: { audioOrder: 2, burnSubtitleOrder: undefined } });
  });

  it('asks for a burned-in subtitle when that is the only one in the language', () => {
    expect(rememberedStart(source({}), { subtitle: 'fr' })).toEqual({ text: null, change: { audioOrder: undefined, burnSubtitleOrder: 5 } });
  });
});
