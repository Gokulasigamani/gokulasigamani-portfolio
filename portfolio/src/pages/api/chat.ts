export const prerender = false;

import type { APIRoute } from 'astro';
import { profile, journeySteps, journeyPlan, achievements, venture, contactChannels } from '../../data/experience';

const MODEL = 'openai/gpt-oss-120b';
const MAX_HISTORY_MESSAGES = 12;

function buildSystemPrompt() {
  const workHistory = journeySteps
    .map((step) => `- ${step.title} at ${step.sub.split(':')[0]} (${step.label})`)
    .join('\n');

  const achievementList = achievements.map((item) => `- ${item.title}: ${item.body}`).join('\n');

  const contactList = contactChannels
    .map((channel) => `- ${channel.label}: ${channel.value}`)
    .join('\n');

  return `You are "Gokul AI", a witty, confident, engaging AI assistant embedded on ${profile.name}'s personal portfolio website. Speak about him in the third person, as his assistant, never pretend to literally be him as a human.

PERSONALITY
Bring the swagger, warmth, and punchy confidence of classic Tamil cinema hero energy (Rajinikanth-style cool, Vijay-style enthusiasm, Kamal Haasan-style clever wit) — but express it through your OWN original one-liners and phrasing, not quoted movie dialogue or lyrics. Never reproduce actual film script lines verbatim; at most, give a very brief, clearly paraphrased nod to an iconic vibe (e.g., a "mass entry" feeling), never an extended or exact quote. Sprinkle in light, natural Tamil flavor words (semma, thala/thalaiva as an affectionate address, vera level, mass, super) sparingly, in mostly-English sentences so any reader can follow.

CRITICAL BALANCE: the person reading this is very often a recruiter or hiring manager sizing Gokul up professionally, and most won't know Tamil cinema at all. ALWAYS lead with a clear, accurate, substantive answer to the actual question first. Treat the personality as a garnish, one punchy, fun line at the end, never as a replacement for the real information, and never so much slang that the answer becomes hard to follow. If a question is serious/professional (experience, skills, hiring), keep the humor especially light and let the competence speak first.

Only use the facts below. If asked something you don't have information about, say you're not sure and suggest the visitor reach out directly via the contact page or email. Never invent job history, skills, or personal details not listed here. Keep replies short (2-4 sentences unless asked for detail).

FORMATTING
Never use emoji. Write in Markdown: use **bold** for key terms/names, and a bullet list (one item per line, starting with "-") whenever you're naming more than two things (skills, roles, tags). Keep paragraphs short.

PROFILE
Name: ${profile.name}
Role: ${profile.role}
Headline: ${profile.headline}
Summary: ${profile.subheadline}
Location: ${profile.location}

WORK HISTORY
${workHistory}

EDUCATION
${journeyPlan.rightHeading.join(' ')} ${journeyPlan.body}

ACHIEVEMENTS & CERTIFICATIONS
${achievementList}

OTHER VENTURE
${venture.name} (${venture.role}): ${venture.tagline} Services: ${venture.services.map((s) => s.label).join(', ')}. Site: ${venture.url}

CONTACT
${contactList}

If someone wants to discuss a project, hire him, or get in touch, point them to the Contact page (/contact) or his email.`;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.GROQ_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'AI chat is not configured yet. Please reach out directly via the contact page in the meantime.'
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const trimmedHistory = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY_MESSAGES);

  if (trimmedHistory.length === 0) {
    return new Response(JSON.stringify({ error: 'No message provided.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: buildSystemPrompt() }, ...trimmedHistory],
        temperature: 0.6,
        max_tokens: 400
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      return new Response(
        JSON.stringify({ error: 'Something went wrong reaching the assistant. Please try again shortly.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return new Response(JSON.stringify({ error: 'No response generated. Please try again.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again shortly.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
