// Coach-only: writes a review of one check-in with Claude, and saves edits to it.
//   POST /api/review?id=...            write (or rewrite) the review
//   PUT  /api/review?id=...  {message}  save the coach's edited message
const Anthropic = require('@anthropic-ai/sdk');
const { redis, isCoach, parse, KEY_PREFIX, ID_RE } = require('../lib/store.js');
const { SECTIONS } = require('../questions.js');
const { REVIEW_PROMPT } = require('../lib/review-prompt.js');

const client = process.env.ANTHROPIC_API_KEY ? new (Anthropic.default || Anthropic)() : null;

module.exports = async (req, res) => {
  if (!isCoach(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!redis) return res.status(503).json({ error: 'Database not connected' });
  const id = String((req.query && req.query.id) || '');
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad id' });

  const record = parse(await redis.get(KEY_PREFIX + id));
  if (!record) return res.status(404).json({ error: 'Check-in not found' });

  if (req.method === 'PUT') {
    const message = String((req.body && req.body.message) || '').trim().slice(0, 8000);
    if (!message || !record.review) return res.status(400).json({ error: 'Nothing to save' });
    record.review = { ...record.review, message, editedAt: new Date().toISOString() };
    await redis.set(KEY_PREFIX + id, JSON.stringify(record));
    return res.status(200).json({ review: record.review });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!client) {
    return res.status(503).json({ error: 'Reviews need an ANTHROPIC_API_KEY in Vercel', reason: 'missing_api_key' });
  }

  try {
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      // If the main model declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: REVIEW_PROMPT,
      messages: [{ role: 'user', content: answersAsText(record) }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') {
      return res.status(502).json({ error: "Claude couldn't write this review. Try again or write it yourself." });
    }
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const { message, notes } = splitReview(text);
    if (!message) return res.status(502).json({ error: 'The review came back empty. Try again.' });
    record.review = { message, notes, createdAt: new Date().toISOString() };
    await redis.set(KEY_PREFIX + id, JSON.stringify(record));
    return res.status(200).json({ review: record.review });
  } catch (e) {
    console.error('Review failed:', e && (e.status || ''), e && e.message);
    const busy = e && (e.status === 429 || e.status === 529);
    return res.status(502).json({ error: busy ? 'Claude is busy right now. Try again in a minute.' : "Couldn't write the review. Try again." });
  }
};

// The client's answers, grouped by section, as plain text for Claude to read.
function answersAsText(record) {
  const a = record.answers || {};
  const lines = [`Submitted: ${record.submittedAt}`, ''];
  for (const s of SECTIONS) {
    const items = [];
    for (const q of s.qs) {
      let v = a[q.id];
      if (q.type === 'scale') v = v ? `${v}/10` : '';
      if (Array.isArray(v)) v = v.join(', ');
      const note = q.note ? a[q.note.id] : '';
      if (v || note) items.push(`Q: ${q.label}\nA: ${[v, note].filter(Boolean).join(' | ')}`);
    }
    if (items.length) lines.push(`## ${s.title}`, ...items, '');
  }
  return `Here is the client's check-in:\n\n${lines.join('\n').trim()}`;
}

function splitReview(text) {
  const m = text.match(/###\s*Message to client\s*([\s\S]*?)(?:###\s*Coach notes\s*([\s\S]*))?$/i);
  if (!m) return { message: text, notes: '' };
  return { message: m[1].trim(), notes: (m[2] || '').trim() };
}
