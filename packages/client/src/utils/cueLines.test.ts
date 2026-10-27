import { describe, expect, it } from 'vitest';
import { cuesToLines } from './cueLines';

describe('cuesToLines', () => {
  it('splits cues on line breaks and skips blank lines', () => {
    expect(cuesToLines([{ text: 'Hello\nthere' }, { text: '\n  \nSecond cue ' }])).toEqual(['Hello', 'there', 'Second cue']);
    expect(cuesToLines([{ text: 'a\r\nb' }])).toEqual(['a', 'b']);
  });

  it('drops WebVTT markup and decodes its entities', () => {
    expect(cuesToLines([{ text: '<i>Tom &amp; Jerry</i>' }])).toEqual(['Tom & Jerry']);
    expect(cuesToLines([{ text: '<v Alice>1 &lt; 2</v>' }, { text: '<c.yellow>Yes</c> <00:01.000>now' }])).toEqual(['1 < 2', 'Yes now']);
  });

  it('keeps unknown entities and angle text out of the markup path as plain text', () => {
    expect(cuesToLines([{ text: 'a &copy; b' }])).toEqual(['a &copy; b']);
  });

  it('copes with no cues and with cues that carry no text', () => {
    expect(cuesToLines([])).toEqual([]);
    expect(cuesToLines([{}, { text: '' }])).toEqual([]);
  });
});
