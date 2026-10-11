import { colors } from './tokens';

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return ((la as number) + 0.05) / ((lb as number) + 0.05);
}

describe('jetons de design', () => {
  it('reprend les couleurs de la charte', () => {
    expect(colors).toMatchObject({
      background: '#0A0A0A',
      surface: '#1A1A1A',
      accent: '#9026FF',
      secondary: '#00C4FF',
      text: '#E8E8E8',
    });
  });

  it.each([
    ['texte sur fond', colors.text, colors.background],
    ['texte sur surface', colors.text, colors.surface],
    ['texte sur violet', colors.onAccent, colors.accent],
    ['cyan sur fond', colors.secondary, colors.background],
    ['erreur sur surface', colors.error, colors.surface],
    ['attente sur surface', colors.warning, colors.surface],
  ])('contraste AA (>= 4,5) : %s', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
