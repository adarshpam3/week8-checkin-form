const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Kept apart from the onboarding form's keys, so both can share one database.
const INDEX_KEY = 'checkin8_index';
const KEY_PREFIX = 'checkin8:';

const OPTIONS = {
  hard: ['Sticking to the diet', 'Finding time to train', 'Sleep', 'Weekends and eating out', 'Work stress', 'Motivation', 'Daily check-ins'],
  training: ['Too easy', 'Just right', 'Too hard', 'Getting boring'],
  diet: ['Easy, fits my life', 'Mostly fine', 'Struggling with it'],
  support: ['Super useful, keep as is', 'Useful, could be shorter', 'Want more contact', 'Feels like a chore'],
  more: ['Form checks on your lifts', 'More quick recipes', 'Eating-out guide', 'Sleep and stress help', 'Push me harder', 'Faster replies'],
};
const TEXT_FIELDS = ['name', 'win', 'hard_note', 'diet_note', 'more_note', 'goal', 'else_'];

module.exports = async (req, res) => {
  if (req.method === 'POST') return handleSubmit(req, res);
  if (req.method === 'GET') return handleList(req, res);
  if (req.method === 'DELETE') return handleDelete(req, res);
  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};

function isCoach(req) {
  const given = String(req.headers['x-coach-passcode'] || '');
  const real = String(process.env.COACH_PASSCODE || '');
  if (!given || !real) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

// Only keep known fields, known options, and sensible lengths.
function clean(input) {
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const one = (v, list) => (list.includes(v) ? v : '');
  const many = (v, list) => (Array.isArray(v) ? [...new Set(v.filter((x) => list.includes(x)))] : []);
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) return null;
  const out = { rating };
  for (const f of TEXT_FIELDS) out[f] = text(input[f], f === 'name' ? 120 : 4000);
  out.hard = many(input.hard, OPTIONS.hard);
  out.more = many(input.more, OPTIONS.more);
  out.training = one(input.training, OPTIONS.training);
  out.diet = one(input.diet, OPTIONS.diet);
  out.support = one(input.support, OPTIONS.support);
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
    return res.status(500).json({ error: 'Failed to save check-in' });
  }
}

async function handleList(req, res) {
  if (!isCoach(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const keys = await redis.zrange(INDEX_KEY, 0, -1, { rev: true });
    if (!keys || keys.length === 0) return res.status(200).json({ checkins: [] });
    const values = await redis.mget(...keys);
    const checkins = values
      .map((raw) => {
        try {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
    return res.status(200).json({ checkins });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load check-ins' });
  }
}

async function handleDelete(req, res) {
  if (!isCoach(req)) return res.status(401).json({ error: 'Unauthorized' });
  const id = String((req.query && req.query.id) || '');
  if (!/^\d+-[a-f0-9]{8}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
  try {
    await redis.del(KEY_PREFIX + id);
    await redis.zrem(INDEX_KEY, KEY_PREFIX + id);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete check-in' });
  }
}
