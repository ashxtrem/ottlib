import { describe, expect, it } from 'vitest';
import { parseReleaseName, parseTitle } from './titleParser.js';

describe('parseTitle', () => {
  it.each([
    ['D:\\Movies\\The.Matrix.1999.1080p.BluRay.x264.mkv', { title: 'The Matrix', year: 1999 }],
    ['D:\\Movies\\3.Idiots.2009.720p.WEB-DL.mkv', { title: '3 Idiots', year: 2009 }],
    ['D:\\Movies\\Inception.1080p.x265.mkv', { title: 'Inception', year: null }],
    ['D:\\Movies\\Interstellar (2014) [WEBRip].mp4', { title: 'Interstellar', year: 2014 }],
    ['D:\\Movies\\Dune.Part.Two\\movie.mkv', { title: 'Dune Part Two', year: null }],
    ['D:\\Shows\\Dragon Ball SUPER - S01 E01 - A Peacetime Reward (720p BluRay - DUAL Audio).mkv', { title: 'Dragon Ball SUPER A Peacetime Reward', year: null }],
    ['D:\\Shows\\Some.Show.S02E08.Change.1080p.WEB-DL.mkv', { title: 'Some Show Change', year: null }],
    ['D:\\Shows\\Another Show 1x05 Title.mkv', { title: 'Another Show Title', year: null }],
    ['D:\\Shows\\01 Police Squad A Substantial Gift - Comedy 1982 Eng Subs 1080p [H264-mp4].mp4', { title: 'Police Squad A Substantial Gift', year: 1982 }],
    ['D:\\Shows\\03 Police Squad The Butler Did It - Comedy 1982 Eng Subs 1080p [H264-mp4].mp4', { title: 'Police Squad The Butler Did It', year: 1982 }],
    ['D:\\Movies\\300.2006.1080p.BluRay.x264.mkv', { title: '300', year: 2006 }]
  ])('parses %s', (path, expected) => expect(parseTitle(path)).toEqual(expected));
});

describe('parseReleaseName', () => {
  it.each([
    ['Inception.2010.2160p.BluRay.x265-GROUP', { title: 'Inception', year: 2010 }],
    ['The.Matrix.1999.1080p.BluRay.x264', { title: 'The Matrix', year: 1999 }],
    ['Dune Part Two 2024 WEB-DL', { title: 'Dune Part Two', year: 2024 }]
  ])('parses a bare release name without treating a codec as an extension: %s', (name, expected) => expect(parseReleaseName(name)).toEqual(expected));
});
