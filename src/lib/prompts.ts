import { getStylePrompt, PresetStyleId } from './styles';

export function buildIconConcepts(basePrompt: string): string[] {
  const prompt = basePrompt.trim();

  if (!prompt) {
    return [];
  }

  return [
    `${prompt} main symbol`,
    `${prompt} key object`,
    `${prompt} emblem`,
    `${prompt} abstract mark`,
  ];
}

export function buildPalettePrompt(colors: string[]): string {
  const palette = colors.map((color) => color.trim()).filter(Boolean);

  if (!palette.length) {
    return '';
  }

  return `Use only these hex colours: ${palette.join(', ')}.`;
}

export function buildFinalPrompt(
  basePrompt: string,
  styleId: PresetStyleId,
  colors: string[],
  concept: string,
): string {
  const conceptText = concept.trim() || basePrompt.trim();
  const palettePrompt = buildPalettePrompt(colors);
  const parts = [
    conceptText,
    getStylePrompt(styleId),
    palettePrompt,
    'Single centred icon, 1:1 aspect ratio, no text or background elements.',
  ];

  return parts.filter((part) => part.trim().length > 0).join(' ');
}

