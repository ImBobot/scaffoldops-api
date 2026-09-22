const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { inspectionSchema } = require('../validation/schemas');

// Any internal role can log an inspection — that's the crew member who
// actually did the scan/inspect/sign in the field.
router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/scaffold/:scaffoldId', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'select * from inspections where scaffold_id = $1 order by inspected_at desc',
    [req.params.scaffoldId]
  );
  res.json(rows);
}));

// Scan -> inspect -> photograph -> sign. Result sets the scaffold's live tag
// colour in the SAME transaction, so the dashboard is never out of sync.
router.post('/', validate(inspectionSchema), asyncHandler(async (req, res) => {
  const { scaffold_id, inspector_worker_id, result, notes, latitude, longitude } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `insert into inspections (scaffold_id, inspector_worker_id, result, notes, latitude, longitude)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [scaffold_id, inspector_worker_id, result, notes || null, latitude ?? null, longitude ?? null]
    );
    await client.query('update scaffolds set status = $1 where id = $2', [result, scaffold_id]);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;
