import { Buffer } from 'buffer';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { buildFinalPrompt } from '@/lib/prompts';
import { PresetStyleId } from '@/lib/styles';

function buildClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    throw new Error('Missing REPLICATE_API_TOKEN');
  }

  return new Replicate({ auth: token });
}

function arrayBufferToDataUrl(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  if (!bytes.byteLength) {
    return '';
  }

  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
}

async function streamToDataUrl(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!chunks.length) {
    return '';
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return arrayBufferToDataUrl(buffer);
}

async function collectUrls(value: unknown): Promise<string[]> {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (value instanceof ReadableStream) {
    const url = await streamToDataUrl(value);
    return url ? [url] : [];
  }

  if (value instanceof Blob) {
    const url = arrayBufferToDataUrl(await value.arrayBuffer());
    return url ? [url] : [];
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    const url = arrayBufferToDataUrl(value as ArrayBuffer | Uint8Array);
    return url ? [url] : [];
  }

  if (Array.isArray(value)) {
    const nested = await Promise.all(value.map((entry) => collectUrls(entry)));
    return nested.flat();
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const urls: string[] = [];
    const directKeys = ['url', 'href', 'image', 'image_url', 'uri'] as const;

    for (const key of directKeys) {
      const entry = record[key];
      if (typeof entry === 'string' && entry.trim()) {
        urls.push(entry.trim());
        continue;
      }

      if (entry) {
        urls.push(...(await collectUrls(entry)));
      }
    }

    if (typeof record.image_base64 === 'string' && record.image_base64.trim()) {
      urls.push(`data:image/png;base64,${record.image_base64.trim()}`);
    }

    const nestedKeys = ['urls', 'images', 'output', 'content', 'results', 'assets'] as const;

    for (const key of nestedKeys) {
      const nested = record[key];
      if (nested) {
        urls.push(...(await collectUrls(nested)));
      }
    }

    return urls;
  }

  return [];
}

async function firstImageUrl(payload: unknown): Promise<string> {
  const urls = await collectUrls(payload);
  return urls.find((url) => url.length > 0) ?? '';
}

function randomSeed(): number {
  const buffer = new Uint32Array(1);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buffer);
    return buffer[0];
  }

  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function fetchThemeItems(theme: string): Promise<string[]> {
  const trimmedTheme = theme.trim();

  if (!trimmedTheme) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Suggest four concise, comma-separated items related to the theme "${trimmedTheme}". Respond with only the list.`,
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message ?? 'Gemini request failed';
    throw new Error(message);
  }

  const text =
    payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part?.text?.trim() ?? '')
      .filter(Boolean)
      .join(' ') ?? '';

  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { prompt, presetStyle, colors = [] } = await request.json();

    if (!prompt || !presetStyle) {
      return NextResponse.json({ message: 'prompt and presetStyle are required.' }, { status: 400 });
    }

    const themeItems = await fetchThemeItems(prompt);

    if (themeItems.length < 1) {
      return NextResponse.json({ message: 'Unable to derive icon concepts. Try a more descriptive prompt.' }, { status: 400 });
    }

    const concepts = themeItems.map((item) => `${prompt} ${item} icon`.trim());

    const replicate = buildClient();

    const seed = randomSeed();

    const urls = await Promise.all(
      concepts.map(async (concept, index) => {
        const promptText = buildFinalPrompt(prompt, presetStyle as PresetStyleId, colors, concept);
        console.log('Generating icon with prompt:', promptText);
        const output = await replicate.run('black-forest-labs/flux-schnell', {
          input: {
            prompt: promptText,
            num_outputs: 1,
            aspect_ratio: '1:1',
            output_format: 'png',
            output_quality: 100,
            seed: seed + index,
            go_fast: true,
          },
        });
        console.log('output', output);
        return firstImageUrl(output);
      }),
    );

    const filteredUrls = urls.filter((url) => url.length > 0);

    if (!filteredUrls.length) {
      return NextResponse.json({ message: 'Replicate returned no images. Try a more descriptive prompt.' }, { status: 502 });
    }

    return NextResponse.json({ urls: filteredUrls });
  } catch (error) {
    console.error('Error generating icons', error);

    if (error instanceof Error && (error.message === 'Missing REPLICATE_API_TOKEN' || error.message === 'Missing GEMINI_API_KEY')) {
      const message =
        error.message === 'Missing REPLICATE_API_TOKEN'
          ? 'Replicate API token not configured.'
          : 'Gemini API key not configured.';
      return NextResponse.json({ message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Failed to generate icons.' }, { status: 500 });
  }
}
