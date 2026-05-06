const { query }  = require('./database');
const { logger } = require('./logger');

/**
 * Write one row to audit_log.
 * Fire-and-forget — never throws so it never blocks the caller.
 */
async function auditLog(adminId, action, targetType, targetId, details = {}) {
  try {
    await query(
      `INSERT INTO audit_log (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetType, targetId, JSON.stringify(details)]
    );
  } catch (err) {
    logger.error(`Audit log write failed: ${err.message}`);
  }
}

module.exports = { auditLog };
