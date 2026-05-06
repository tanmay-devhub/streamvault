const { query } = require('../utils/database');

async function recordHeatmap(req, res) {
  const { id } = req.params;
  const { bucket } = req.body;
  if (typeof bucket !== 'number' || bucket < 0) {
    return res.status(400).json({ error: 'bucket must be a non-negative number.' });
  }
  try {
    await query(
      `INSERT INTO heatmap_events (video_id, bucket, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (video_id, bucket) DO UPDATE SET count = heatmap_events.count + 1`,
      [id, Math.floor(bucket)]
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
}

async function getHeatmap(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await query(
      'SELECT bucket, count FROM heatmap_events WHERE video_id = $1 ORDER BY bucket',
      [id]
    );
    res.json({
      buckets: rows.map((r) => ({ bucket: parseInt(r.bucket), count: parseInt(r.count) })),
    });
  } catch {
    res.json({ buckets: [] });
  }
}

module.exports = { recordHeatmap, getHeatmap };
