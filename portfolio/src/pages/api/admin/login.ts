export const prerender = false;

import type { APIRoute } from 'astro';
import { checkPassword, createSessionToken, SESSION_COOKIE_NAME } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!body.password || !checkPassword(body.password)) {
    return new Response(JSON.stringify({ error: 'Incorrect password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  cookies.set(SESSION_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
