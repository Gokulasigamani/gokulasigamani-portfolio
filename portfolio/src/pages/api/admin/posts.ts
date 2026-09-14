export const prerender = false;

import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { getAllPostsForAdmin, createPost, slugify } from '../../../lib/db';

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const posts = await getAllPostsForAdmin();
  return new Response(JSON.stringify({ posts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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
    const post = await createPost({
      slug: slugify(title),
      title,
      description,
      body: bodyMarkdown,
      coverImage,
      tags: Array.isArray(tags) ? tags : [],
      published: Boolean(published)
    });
    return new Response(JSON.stringify({ post }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('duplicate key')) {
      return new Response(JSON.stringify({ error: 'A post with this title already exists.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (message.includes('Database is not configured')) {
      return new Response(JSON.stringify({ error: message }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.error('Create post error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong saving the post.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
