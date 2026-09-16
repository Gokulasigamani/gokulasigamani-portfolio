import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/db';

export const prerender = false;

const staticRoutes = ['/', '/contact', '/blog', '/talk'];

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') ?? '';
  const posts = await getPublishedPosts();

  const staticEntries = staticRoutes.map(
    (path) => `  <url>\n    <loc>${base}${path}</loc>\n  </url>`
  );

  const postEntries = posts.map((post) => {
    const lastmod = new Date(post.updated_at ?? post.published_at ?? post.created_at).toISOString();
    return `  <url>\n    <loc>${base}/blog/${post.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...staticEntries,
    ...postEntries
  ].join('\n')}\n</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' }
  });
};
