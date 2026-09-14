export const prerender = false;

import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../../lib/auth';
import { getPostById, updatePost, deletePost, slugify } from '../../../../lib/db';

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return new Response(JSON.stringify({ error: 'Invalid post id.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const existing = await getPostById(id);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: {
    title?: string;
    description?: string;
    bodyMarkdown?: string;
    coverImage?: string;
    tags?: string[];
    published?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { title, description, bodyMarkdown, coverImage, tags, published } = body;
  if (!title || !description || !bodyMarkdown || !coverImage) {
    return new Response(JSON.stringify({ error: 'Title, description, cover image, and body are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const post = await updatePost(id, {
      slug: slugify(title),
      title,
      description,
      body: bodyMarkdown,
      coverImage,
      tags: Array.isArray(tags) ? tags : [],
      published: Boolean(published)
    });
    return new Response(JSON.stringify({ post }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('Database is not configured')) {
      return new Response(JSON.stringify({ error: message }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.error('Update post error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong saving the post.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return new Response(JSON.stringify({ error: 'Invalid post id.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await deletePost(id);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
