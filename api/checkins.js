const crypto = require('crypto');
const { redis, isCoach, parse, INDEX_KEY, KEY_PREFIX, ID_RE } = require('../lib/store.js');
const { QUESTIONS } = require('../questions.js');

module.exports = async (req, res) => {
  if (!redis) {
    console.error('Redis is not configured: no KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_*) env vars found');
    return res.status(503).json({ error: 'Database not connected', reason: 'missing_database_settings' });
  }
  if (req.method === 'POST') return handleSubmit(req, res);
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'DELETE') return handleDelete(req, res);
  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};

// Only keep known questions, known options, and sensible lengths.
function clean(input) {
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const out = {};
  for (const q of QUESTIONS) {
    const v = input[q.id];
    if (q.type === 'scale') {
      const n = Number(v);
      out[q.id] = Number.isInteger(n) && n >= 1 && n <= 10 ? n : 0;
      if (q.required && !out[q.id]) return null;
    } else if (q.type === 'one') {
      out[q.id] = q.options.includes(v) ? v : '';
    } else if (q.type === 'many') {
      out[q.id] = Array.isArray(v) ? [...new Set(v.filter((x) => q.options.includes(x)))] : [];
    } else {
      out[q.id] = text(v, q.id === 'name' ? 120 : 4000);
    }
    if (q.note) out[q.note.id] = text(input[q.note.id], 4000);
  }
  return out;
}

async function handleSubmit(req, res) {
  try {
    const { answers, website } = req.body || {};
    // Hidden "website" field: real people leave it empty, spam bots fill it in.
    if (website) return res.status(200).json({ success: true });
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Missing answers' });
    }
    const data = clean(answers);
    if (!data) return res.status(400).json({ error: 'Pick a score from 1 to 10' });
    const timestamp = Date.now();
    const id = `${timestamp}-${crypto.randomBytes(4).toString('hex')}`;
    const record = { id, answers: data, submittedAt: new Date(timestamp).toISOString() };
    await redis.set(KEY_PREFIX + id, JSON.stringify(record));
    await redis.zadd(INDEX_KEY, { score: timestamp, member: KEY_PREFIX + id });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("Save failed:", e && e.message);
    return res.status(500).json({ error: "Failed to save check-in" });
  }
}

async function handleList(req, res) {
  if (!isCoach(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const keys = await redis.zrange(INDEX_KEY, 0, -1, { rev: true });
    if (!keys || keys.length === 0) return res.status(200).json({ checkins: [] });
    const values = await redis.mget(...keys);
    const checkins = values
      .map(parse)
      .filter(Boolean);
    return res.status(200).json({ checkins });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load check-ins' });
  }
}

async function handleDelete(req, res) {
  if (!isCoach(req)) return res.status(401).json({ error: 'Unauthorized' });
  const id = String((req.query && req.query.id) || '');
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad id' });
  try {
    await redis.del(KEY_PREFIX + id);
    await redis.zrem(INDEX_KEY, KEY_PREFIX + id);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete check-in' });
  }
}
