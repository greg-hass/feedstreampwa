import { describe, expect, it } from 'vitest';
import { calculateReadTime, formatReadTime } from './readTime';

describe('calculateReadTime', () => {
  it('returns 0 for empty input', () => {
    expect(calculateReadTime('')).toBe(0);
  });

  it('returns at least 1 minute for short content', () => {
    expect(calculateReadTime('Hello world')).toBe(1);
  });

  it('strips HTML before counting words', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(calculateReadTime(html)).toBe(1);
  });

  it('rounds up to the next minute', () => {
    const words = Array.from({ length: 226 }, () => 'word').join(' ');
    expect(calculateReadTime(words)).toBe(2);
  });
});

describe('formatReadTime', () => {
  it('formats singular minute', () => {
    expect(formatReadTime(1)).toBe('1 min read');
  });

  it('formats minutes under an hour', () => {
    expect(formatReadTime(12)).toBe('12 min read');
  });

  it('formats exact hours', () => {
    expect(formatReadTime(120)).toBe('2 hours read');
  });

  it('formats hours and minutes', () => {
    expect(formatReadTime(61)).toBe('1h 1m read');
  });
});
