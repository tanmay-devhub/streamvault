const { query } = require('./database');

function rowToProfile(row) {
  if (!row) return null;
  return {
    userId:      row.user_id,
    channelName: row.channel_name,
    bio:         row.bio,
    avatarUrl:   row.avatar_url,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

const profileDb = {
  async findByUserId(userId) {
    const { rows } = await query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    return rowToProfile(rows[0]) || null;
  },

  async insert(profile) {
    const { rows } = await query(
      `INSERT INTO profiles (user_id, channel_name, bio, avatar_url, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       RETURNING *`,
      [profile.userId, profile.channelName, profile.bio || '', profile.avatarUrl || '']
    );
    return rowToProfile(rows[0]);
  },

  async update(userId, fields) {
    const sets   = [];
    const params = [userId];
    const colMap = { channelName: 'channel_name', bio: 'bio', avatarUrl: 'avatar_url' };

    for (const [key, val] of Object.entries(fields)) {
      const col = colMap[key];
      if (col) { params.push(val); sets.push(`${col} = $${params.length}`); }
    }
    if (sets.length === 0) return this.findByUserId(userId);

    sets.push('updated_at = NOW()');
    const { rows } = await query(
      `UPDATE profiles SET ${sets.join(', ')} WHERE user_id = $1 RETURNING *`,
      params
    );
    return rowToProfile(rows[0]) || null;
  },

  async delete(userId) {
    const { rowCount } = await query('DELETE FROM profiles WHERE user_id = $1', [userId]);
    return rowCount > 0;
  },

  async search(q, limit = 10) {
    const { rows } = await query(
      `SELECT * FROM profiles WHERE LOWER(channel_name) LIKE $1 ORDER BY channel_name LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit]
    );
    return rows.map(rowToProfile);
  },

  async findAll({ search = '', page = 1, limit = 20 } = {}) {
    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where = `WHERE LOWER(channel_name) LIKE $1`;
    }
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT * FROM profiles ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countRes = await query(`SELECT COUNT(*) FROM profiles ${where}`, search ? [params[0]] : []);
    return { profiles: rows.map(rowToProfile), total: parseInt(countRes.rows[0].count, 10) };
  },

  isUniqueViolation(err) {
    return err.code === '23505'; // PostgreSQL unique_violation
  },
};

module.exports = { profileDb };
