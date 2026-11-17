// Coach-only: saves the review message (and private notes) for one check-in.
//   PUT /api/review?id=...  {message, notes}
// The review itself is written in ChatGPT: the dashboard copies the prompt and answers,
// and the coach pastes ChatGPT's reply back.
const { redis, isCoach, parse, KEY_PREFIX, ID_RE } = require('../lib/store.js');

module.exports = async (req, res) => {
  if (!isCoach(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!redis) return res.status(503).json({ error: 'Database not connected' });
  const id = String((req.query && req.query.id) || '');
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad id' });

  const text = (v) => String(v || '').trim().slice(0, 8000);
  const message = text(req.body && req.body.message);
  if (!message) return res.status(400).json({ error: 'The message is empty' });

  try {
    const record = parse(await redis.get(KEY_PREFIX + id));
    if (!record) return res.status(404).json({ error: 'Check-in not found' });
    const now = new Date().toISOString();
    const notes = req.body && 'notes' in req.body ? text(req.body.notes) : (record.review && record.review.notes) || '';
    record.review = { message, notes, savedAt: now };
    await redis.set(KEY_PREFIX + id, JSON.stringify(record));
    return res.status(200).json({ review: record.review });
  } catch (e) {
    console.error('Saving review failed:', e && e.message);
    return res.status(500).json({ error: "Couldn't save the review. Try again." });
  }
};
