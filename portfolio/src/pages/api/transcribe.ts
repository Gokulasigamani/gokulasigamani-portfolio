export const prerender = false;

import type { APIRoute } from 'astro';

const MODEL = 'whisper-large-v3-turbo';
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.GROQ_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Voice is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const file = incoming.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return new Response(JSON.stringify({ error: 'No audio provided.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (file.size > MAX_FILE_BYTES) {
    return new Response(JSON.stringify({ error: 'Audio clip is too large.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const forwardForm = new FormData();
    forwardForm.set('file', file, file.name || 'audio.webm');
    forwardForm.set('model', MODEL);
    forwardForm.set('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forwardForm
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq STT error:', response.status, errText);
      return new Response(JSON.stringify({ error: 'Transcription failed.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const transcript = typeof data.text === 'string' ? data.text.trim() : '';

    return new Response(JSON.stringify({ transcript }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Transcribe API error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong transcribing audio.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
