const { query } = require('./database');

function rowToVideo(row) {
  if (!row) return null;
  return {
    id:            row.id,
    uploaderId:    row.uploader_id,
    title:         row.title,
    description:   row.description,
    status:        row.status,
    originalName:  row.original_name,
    masterKey:     row.master_key,
    thumbnailKey:  row.thumbnail_key,
    renditionKeys: row.rendition_keys || {},
    s3Prefix:      row.s3_prefix,
    duration:      row.duration,
    resolution:    row.resolution,
    videoCodec:    row.video_codec,
    audioCodec:    row.audio_codec,
    errorMessage:  row.error_message,
    privacy:       row.privacy || 'public',
    likesCount:    row.likes_count || 0,
    viewsCount:    row.views_count || 0,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

// Mapping from camelCase field names to DB column names for UPDATE
const COL_MAP = {
  title:         'title',
  description:   'description',
  status:        'status',
  masterKey:     'master_key',
  thumbnailKey:  'thumbnail_key',
  renditionKeys: 'rendition_keys',
  s3Prefix:      's3_prefix',
  duration:      'duration',
  resolution:    'resolution',
  videoCodec:    'video_codec',
  audioCodec:    'audio_codec',
  errorMessage:  'error_message',
  privacy:       'privacy',
  likesCount:    'likes_count',
  viewsCount:    'views_count',
};

const SORT_COL = { createdAt: 'created_at', title: 'title', duration: 'duration' };

const db = {
  async insert(video) {
    const { rows } = await query(
      `INSERT INTO videos
         (id, uploader_id, title, description, status, original_name, privacy, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       RETURNING *`,
      [
        video.id,
        video.uploaderId || '',
        video.title,
        video.description || '',
        video.status,
        video.originalName || '',
        video.privacy || 'public',
      ]
    );
    return rowToVideo(rows[0]);
  },

  async findAll({
    search           = '',
    sortBy           = 'createdAt',
    order            = 'desc',
    uploaderId       = '',
    requestingUserId = null,
    adminMode        = false,
  } = {}) {
    const params = [];
    const conds  = [];

    let selectExtra = '';
    let joinClause  = '';

    if (search && search.trim().length >= 2) {
      params.push(`%${search.toLowerCase()}%`);
      const likeN = params.length;
      params.push(search.trim());
      const tsN = params.length;

      joinClause  = `LEFT JOIN transcripts t ON t.video_id = v.id`;
      selectExtra = `,
        CASE WHEN COALESCE(t.search_vector @@ plainto_tsquery('english', $${tsN}), false)
          THEN ts_headline('english', t.full_text, plainto_tsquery('english', $${tsN}),
               'MaxWords=20,MinWords=8,StartSel=<<<,StopSel=>>>')
          ELSE NULL END AS transcript_snippet,
        COALESCE(t.search_vector @@ plainto_tsquery('english', $${tsN}), false) AS matched_transcript`;

      conds.push(
        `(LOWER(v.title) LIKE $${likeN} OR LOWER(v.description) LIKE $${likeN} ` +
        `OR COALESCE(t.search_vector @@ plainto_tsquery('english', $${tsN}), false))`
      );
    } else if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conds.push(`(LOWER(v.title) LIKE $${params.length} OR LOWER(v.description) LIKE $${params.length})`);
    }

    if (uploaderId) {
      params.push(uploaderId);
      conds.push(`v.uploader_id = $${params.length}`);
    }

    if (!adminMode) {
      if (requestingUserId) {
        params.push(requestingUserId);
        conds.push(`(v.privacy = 'public' OR v.uploader_id = $${params.length})`);
      } else {
        conds.push(`v.privacy = 'public'`);
      }
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const col   = SORT_COL[sortBy] || 'created_at';
    const dir   = order === 'asc' ? 'ASC' : 'DESC';

    const { rows } = await query(
      `SELECT v.*${selectExtra} FROM videos v ${joinClause} ${where} ORDER BY v.${col} ${dir}`,
      params
    );

    return rows.map((r) => ({
      ...rowToVideo(r),
      transcriptSnippet: r.transcript_snippet  || null,
      matchedTranscript: r.matched_transcript   || false,
    }));
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM videos WHERE id = $1', [id]);
    return rowToVideo(rows[0]) || null;
  },

  async findByStatus(status) {
    const { rows } = await query('SELECT * FROM videos WHERE status = $1', [status]);
    return rows.map(rowToVideo);
  },

  async update(id, fields) {
    const sets   = [];
    const params = [id];

    for (const [key, val] of Object.entries(fields)) {
      const col = COL_MAP[key];
      if (col !== undefined) {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = NOW()');
    const { rows } = await query(
      `UPDATE videos SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return rowToVideo(rows[0]) || null;
  },

  async delete(id) {
    const { rowCount } = await query('DELETE FROM videos WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async incrementViews(id) {
    await query('UPDATE videos SET views_count = views_count + 1 WHERE id = $1', [id]);
  },

  async saveTranscript(videoId, { text, segments, language }) {
    await query(
      `INSERT INTO transcripts (video_id, full_text, segments, language)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (video_id) DO UPDATE SET full_text = $2, segments = $3, language = $4`,
      [videoId, text, JSON.stringify(segments), language]
    );
  },
};

module.exports = { db };
