export const prerender = false;

import type { APIRoute } from 'astro';

const MODEL = 'canopylabs/orpheus-v1-english';
const VOICE = 'troy';
const MAX_INPUT_LENGTH = 1000;

// Groq streams this response, so it can't know the final size up front and
// marks the RIFF and data chunk sizes as open-ended placeholders (0xFFFFFFFF)
// instead of the real byte counts; the file also has a LIST (metadata) chunk
// between fmt and data, not the fixed 44-byte layout a naive reader might
// assume. Desktop browsers are lenient and just read to the end of the file
// regardless of the declared sizes, but mobile media decoders (iOS
// AVFoundation, Android's extractor) can be stricter and silently produce no
// audio for a WAV whose declared chunk sizes don't match its actual bytes -
// the call then shows "speaking" with nothing audible. Rewrite the header
// with the real sizes, walking the actual chunk layout, so every platform
// gets a well-formed file.
function fixWavHeader(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const tag = (offset: number) =>
    String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);

  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    return buffer;
  }

  view.setUint32(4, buffer.byteLength - 8, true);

  for (let offset = 12; offset + 8 <= bytes.length; ) {
    if (tag(offset) === 'data') {
      view.setUint32(offset + 4, buffer.byteLength - offset - 8, true);
      break;
    }
    const chunkSize = view.getUint32(offset + 4, true);
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return buffer;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.GROQ_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Voice is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_INPUT_LENGTH) : '';
  if (!text) {
    return new Response(JSON.stringify({ error: 'No text provided.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        voice: VOICE,
        input: text,
        response_format: 'wav'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq TTS error:', response.status, errText);
      return new Response(JSON.stringify({ error: 'Voice generation failed.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const audio = fixWavHeader(await response.arrayBuffer());
    return new Response(audio, {
      status: 200,
      headers: { 'Content-Type': 'audio/wav' }
    });
  } catch (err) {
    console.error('Speak API error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong generating voice.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
