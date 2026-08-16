import { colorWithAlpha, DEFAULT_PLAYER_COLOR, selectDominantColor } from '@/utils/coverColor';

describe('cover color utilities', () => {
  test('selects the most common saturated cover color', () => {
    const pixels = new Uint8ClampedArray([
      220, 40, 50, 255,
      224, 42, 48, 255,
      221, 41, 51, 255,
      30, 90, 220, 255,
    ]);

    expect(selectDominantColor(pixels)).toBe('#dd2933');
  });

  test('ignores transparent pixels and falls back for an empty image', () => {
    expect(selectDominantColor(new Uint8ClampedArray([255, 0, 0, 0]))).toBe(DEFAULT_PLAYER_COLOR);
  });

  test('converts a theme color to a translucent CSS value', () => {
    expect(colorWithAlpha('#34d399', 0.2)).toBe('rgba(52, 211, 153, 0.2)');
  });
});
