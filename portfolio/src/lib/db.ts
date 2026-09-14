import { sql } from '@vercel/postgres';

// @vercel/postgres reads from process.env directly, but Astro/Vite only
// loads .env values into import.meta.env for server code, not process.env.
// Bridge the values it needs so local dev (and any non-Vercel host) works.
for (const key of ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING'] as const) {
  const value = import.meta.env[key];
  if (value && !process.env[key]) {
    process.env[key] = value;
  }
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  cover_image: string;
  tags: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostWithTags extends Omit<Post, 'tags'> {
  tags: string[];
}

function withParsedTags(post: Post): PostWithTags {
  let tags: string[] = [];
  try {
    tags = JSON.parse(post.tags);
  } catch {
    tags = [];
  }
  return { ...post, tags };
}

function isDbConfigured(): boolean {
  return Boolean(import.meta.env.POSTGRES_URL);
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        body TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        published BOOLEAN NOT NULL DEFAULT false,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `.then(() => undefined);
  }
  return schemaReady;
}

export async function getPublishedPosts(): Promise<PostWithTags[]> {
  if (!isDbConfigured()) {
    console.warn('[db] POSTGRES_URL is not set, returning no posts.');
    return [];
  }
  try {
    await ensureSchema();
    const { rows } = await sql<Post>`
      SELECT * FROM posts WHERE published = true ORDER BY published_at DESC;
    `;
    return rows.map(withParsedTags);
  } catch (err) {
    console.error('[db] getPublishedPosts failed:', err);
    return [];
  }
}

export async function getPostBySlug(slug: string, includeDrafts = false): Promise<PostWithTags | null> {
  if (!isDbConfigured()) {
    console.warn('[db] POSTGRES_URL is not set, returning no post.');
    return null;
  }
  try {
    await ensureSchema();
    const { rows } = includeDrafts
      ? await sql<Post>`SELECT * FROM posts WHERE slug = ${slug} LIMIT 1;`
      : await sql<Post>`SELECT * FROM posts WHERE slug = ${slug} AND published = true LIMIT 1;`;
    return rows[0] ? withParsedTags(rows[0]) : null;
  } catch (err) {
    console.error('[db] getPostBySlug failed:', err);
    return null;
  }
}

export async function getAllPostsForAdmin(): Promise<PostWithTags[]> {
  if (!isDbConfigured()) {
    console.warn('[db] POSTGRES_URL is not set, returning no posts.');
    return [];
  }
  try {
    await ensureSchema();
    const { rows } = await sql<Post>`SELECT * FROM posts ORDER BY created_at DESC;`;
    return rows.map(withParsedTags);
  } catch (err) {
    console.error('[db] getAllPostsForAdmin failed:', err);
    return [];
  }
}

export async function getPostById(id: number): Promise<PostWithTags | null> {
  if (!isDbConfigured()) {
    console.warn('[db] POSTGRES_URL is not set, returning no post.');
    return null;
  }
  try {
    await ensureSchema();
    const { rows } = await sql<Post>`SELECT * FROM posts WHERE id = ${id} LIMIT 1;`;
    return rows[0] ? withParsedTags(rows[0]) : null;
  } catch (err) {
    console.error('[db] getPostById failed:', err);
    return null;
  }
}

export interface PostInput {
  slug: string;
  title: string;
  description: string;
  body: string;
  coverImage: string;
  tags: string[];
  published: boolean;
}

export async function createPost(input: PostInput): Promise<PostWithTags> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured yet. Connect Postgres in Vercel’s Storage tab first.');
  }
  await ensureSchema();
  const tagsJson = JSON.stringify(input.tags);
  const publishedAt = input.published ? new Date().toISOString() : null;
  const { rows } = await sql<Post>`
    INSERT INTO posts (slug, title, description, body, cover_image, tags, published, published_at)
    VALUES (${input.slug}, ${input.title}, ${input.description}, ${input.body}, ${input.coverImage}, ${tagsJson}, ${input.published}, ${publishedAt})
    RETURNING *;
  `;
  return withParsedTags(rows[0]);
}

export async function updatePost(id: number, input: PostInput): Promise<PostWithTags> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured yet. Connect Postgres in Vercel’s Storage tab first.');
  }
  await ensureSchema();
  const existing = await getPostById(id);
  const tagsJson = JSON.stringify(input.tags);
  const publishedAt =
    input.published && !existing?.published ? new Date().toISOString() : (existing?.published_at ?? null);

  const { rows } = await sql<Post>`
    UPDATE posts SET
      slug = ${input.slug},
      title = ${input.title},
      description = ${input.description},
      body = ${input.body},
      cover_image = ${input.coverImage},
      tags = ${tagsJson},
      published = ${input.published},
      published_at = ${publishedAt},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *;
  `;
  return withParsedTags(rows[0]);
}

export async function deletePost(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM posts WHERE id = ${id};`;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
