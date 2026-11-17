// Shared by the API functions: the database connection and the coach passcode check.
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

// Vercel may add a prefix when a database is connected to a second project
// (e.g. STORAGE_KV_REST_API_URL), so accept any name ending the usual way.
function findEnv(suffixes) {
  for (const s of suffixes) if (process.env[s]) return process.env[s];
  const name = Object.keys(process.env).find((k) => suffixes.some((s) => k.endsWith('_' + s)));
  return name ? process.env[name] : '';
}
const REDIS_URL = findEnv(['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL']);
const REDIS_TOKEN = findEnv(['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN']);
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

// Kept apart from the onboarding form's keys, so both can share one database.
const INDEX_KEY = 'checkin8_index';
const KEY_PREFIX = 'checkin8:';
const ID_RE = /^\d+-[a-f0-9]{8}$/;

function isCoach(req) {
  const given = String(req.headers['x-coach-passcode'] || '');
  const real = String(process.env.COACH_PASSCODE || '');
  if (!given || !real) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

const parse = (raw) => {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
};

module.exports = { redis, isCoach, parse, INDEX_KEY, KEY_PREFIX, ID_RE };
