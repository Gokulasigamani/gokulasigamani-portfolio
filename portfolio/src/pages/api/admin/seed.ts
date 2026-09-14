export const prerender = false;

import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { getPostBySlug, createPost } from '../../../lib/db';

const SEED_POSTS = [
  {
    slug: 'building-this-portfolio-with-an-ai-assistant',
    title: 'Building this portfolio with an AI assistant',
    description:
      "How I designed and built this entire site, section by section, with an AI pair-programmer, and what I'd do differently next time.",
    coverImage: '/images/blog-portfolio-cover.webp',
    tags: ['Process', 'AI', 'Web Dev'],
    published: true,
    body: `Every section on this site went through the same loop: describe what I wanted, look at what came back, correct the details that were wrong, and iterate until it actually felt right. That loop is the whole story of how this portfolio got built.

## Starting from a blank page

I didn't start with a wireframe. I started with reference screenshots of layouts I liked and a rough sense of what I wanted the site to say about me: full-stack engineer, comfortable with AWS and cloud infrastructure, and increasingly working with AI-driven automation.

## The parts that were harder than expected

The scroll-stacking cards in the experience section looked simple in my head and turned into a genuine debugging exercise. The fix was structural: every card needed to share the same containing block so a later card could become sticky while an earlier one was still pinned.

## Why an AI assistant, specifically

The value wasn't autocomplete. It was being able to say "the accordion feels cluttered" and have that get diagnosed back to a specific, verifiable cause rather than a guess.

If you're building something similar, my honest advice: know exactly what you want before you ask for it.`
  },
  {
    slug: 'what-ulrs-taught-me-about-ai-document-review',
    title: 'What ULRS taught me about AI-driven document review',
    description:
      'Notes from building a self-learning platform that reads mortgage documents, and why the hard part was never the AI model.',
    coverImage: '/images/blog-ulrs-cover.webp',
    tags: ['AI', 'Full Stack', 'Lessons'],
    published: true,
    body: `ULRS (Universal Loan Review System) is an AI-based platform built to understand mortgage documents, datasets, and business rules well enough to automate key parts of loan onboarding.

## The model is rarely the bottleneck

Most of the hard problems were about everything around the model: how configurable the review scope needed to be, how to keep business rules from turning into a tangle of special cases, and how to make the system scalable.

## Configurability as a first-class requirement

Building ULRS to be genuinely configurable meant treating "review scope" and "product-line coverage" as data the system could be configured with, not logic baked into the code.

## What I'd tell someone starting a similar project

Don't design the AI pipeline first. Design the configuration model first, the thing that lets non-engineers adjust scope and rules without a code change.`
  }
];

export const POST: APIRoute = async ({ cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const seed of SEED_POSTS) {
    const existing = await getPostBySlug(seed.slug, true);
    if (existing) {
      skipped.push(seed.slug);
      continue;
    }
    await createPost({
      slug: seed.slug,
      title: seed.title,
      description: seed.description,
      body: seed.body,
      coverImage: seed.coverImage,
      tags: seed.tags,
      published: seed.published
    });
    created.push(seed.slug);
  }

  return new Response(JSON.stringify({ created, skipped }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
