import { describe, expect, it } from 'vitest';
import { buildFinalPrompt, buildIconConcepts } from '@/lib/prompts';
import { getStylePrompt, type PresetStyleId } from '@/lib/styles';

describe('buildIconConcepts', () => {
  it('returns four variations containing the base prompt', () => {
    const result = buildIconConcepts('solar dashboard');

    expect(result).toHaveLength(4);
    result.forEach((concept) => {
      expect(concept).toContain('solar dashboard');
    });
  });

  it('returns empty array for blank prompts', () => {
    expect(buildIconConcepts('   ')).toEqual([]);
  });
});

describe('buildFinalPrompt', () => {
  const styleId: PresetStyleId = 'sticker';
  const stylePrompt = getStylePrompt(styleId);
  const colors = ['#FFAA00', '#222222'];

  it('combines concept, style prompt, and palette sentence', () => {
    const finalPrompt = buildFinalPrompt('smart locks', styleId, colors, 'smart locks key object');

    expect(finalPrompt).toContain('smart locks key object');
    expect(finalPrompt).toContain(stylePrompt);
    expect(finalPrompt).toContain('Use only these hex colours: #FFAA00, #222222.');
    expect(finalPrompt).toContain('Single centred icon');
  });

  it('omits palette sentence if colors array is empty', () => {
    const finalPrompt = buildFinalPrompt('smart locks', styleId, [], 'smart locks emblem');

    expect(finalPrompt).not.toContain('Use only these hex colours');
  });
});

