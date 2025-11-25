export type PresetStyleId =
  | 'sticker'
  | 'pastels'
  | 'business'
  | 'cartoon'
  | '3d-model'
  | 'gradient';

export type PresetStyle = {
  id: PresetStyleId;
  label: string;
  stylePrompt: string;
};

export const PRESET_STYLES: PresetStyle[] = [
  {
    id: 'sticker',
    label: 'Sticker',
    stylePrompt: 'Playful outlined art that looks like a sticker, crisp edges, high contrast decals.',
  },
  {
    id: 'pastels',
    label: 'Pastels',
    stylePrompt: 'Soft pastel palette with light gradients and airy highlights, gentle lighting.',
  },
  {
    id: 'business',
    label: 'Business',
    stylePrompt: 'Clean professional iconography, bold flat colours, minimal decorative detail.',
  },
  {
    id: 'cartoon',
    label: 'Cartoon',
    stylePrompt: 'Cute cartoon style with chunky outlines and simple shading, friendly characters.',
  },
  {
    id: '3d-model',
    label: '3D Model',
    stylePrompt: 'Clay-like 3D render with soft shadows, subtle reflections, studio lighting.',
  },
  {
    id: 'gradient',
    label: 'Gradient',
    stylePrompt: 'Vibrant gradient fills, smooth transitions, minimal detail and plenty of negative space.',
  },
];

export function getStylePrompt(styleId: PresetStyleId): string {
  const preset = PRESET_STYLES.find((style) => style.id === styleId);

  if (!preset) {
    throw new Error(`Unknown preset style: ${styleId}`);
  }

  return preset.stylePrompt;
}

