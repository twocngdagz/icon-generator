'use client';

import { FormEvent, useCallback, useMemo, useState } from 'react';
import { PRESET_STYLES, type PresetStyleId } from '@/lib/styles';
import Image from "next/image";

const CANVAS_SIZE = 512;

async function drawToCanvas(url: string): Promise<Blob | null> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to download image.');
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create canvas context.');
  }

  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  context.drawImage(bitmap, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png');
  });
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [presetStyle, setPresetStyle] = useState<PresetStyleId>(PRESET_STYLES[0].id);
  const [colorInput, setColorInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = useMemo(() => {
    return colorInput
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }, [colorInput]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!prompt.trim()) {
        setError('Enter a prompt before generating icons.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/generate-icons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            presetStyle,
            colors,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data?.message ?? 'Failed to generate icons.');
        }

        const data = await response.json();
        setImageUrls(Array.isArray(data?.urls) ? data.urls : []);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Something went wrong.');
        setImageUrls([]);
      } finally {
        setIsLoading(false);
      }
    },
    [colors, presetStyle, prompt],
  );

  const handleDownload = useCallback(async (url: string, index: number) => {
    try {
      const blob = await drawToCanvas(url);

      if (!blob) {
        throw new Error('Unable to prepare download.');
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `icon-${index + 1}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 py-16 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 rounded-3xl bg-white px-8 py-12 shadow-xl">
        <section className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase text-zinc-500">Icon Set Forge</p>
          <h1 className="text-4xl font-bold">Generate four matching icons in one click</h1>
          <p className="text-base text-zinc-600">
            Describe your concept, pick a preset style, and we will draft four coordinated icons with a consistent look.
          </p>
        </section>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="prompt">
              Prompt for Icon Set
            </label>
            <input
              id="prompt"
              name="prompt"
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base focus:border-black focus:outline-none"
              placeholder="e.g. Smart home controls"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="style">
              Preset Style
            </label>
            <select
              id="style"
              name="style"
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base focus:border-black focus:outline-none"
              value={presetStyle}
              onChange={(event) => setPresetStyle(event.target.value as PresetStyleId)}
            >
              {PRESET_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="colors">
              Optional Colour Palette
            </label>
            <input
              id="colors"
              name="colors"
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base focus:border-black focus:outline-none"
              placeholder="#FFEE99, #221133 or space separated"
              value={colorInput}
              onChange={(event) => setColorInput(event.target.value)}
            />
            <p className="text-xs text-zinc-500">Separate hex values with commas or spaces.</p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            className="w-full rounded-2xl bg-black px-6 py-4 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Generating…' : 'Generate Icons'}
          </button>
        </form>

        {imageUrls.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Icon Preview</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {imageUrls.map((url, index) => (
                <div key={url} className="space-y-3 rounded-2xl border border-zinc-200 p-4">
                  <img alt={`Generated icon ${index + 1}`} className="h-64 w-full rounded-xl object-cover" src={url} />
                  <button
                    type="button"
                    className="w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-900"
                    onClick={() => handleDownload(url, index)}
                  >
                    Download 512×512 PNG
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
