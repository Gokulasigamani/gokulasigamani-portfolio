export const prerender = false;

import type { APIRoute } from 'astro';

const MODEL = 'canopylabs/orpheus-v1-english';
const VOICE = 'daniel';
const MAX_INPUT_LENGTH = 1000;

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

    const audio = await response.arrayBuffer();
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
