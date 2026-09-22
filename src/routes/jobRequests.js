const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { crewCanDoWorkType } = require('../utils/competency');
const { jobRequestSchema, scheduleSchema } = require('../validation/schemas');

// Builders submit requests, so this stays open to any authenticated role —
// only scheduling (below) is restricted to staff.
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    select jr.*, s.name as site_name, s.address as site_address
    from job_requests jr
    join sites s on s.id = jr.site_id
    order by jr.created_at desc
  `);
  res.json(rows);
}));

router.post('/', validate(jobRequestSchema), asyncHandler(async (req, res) => {
  const { site_id, requested_by, work_type, needed_by, notes } = req.body;
  const { rows } = await pool.query(
    `insert into job_requests (site_id, requested_by, work_type, needed_by, notes)
     values ($1,$2,$3,$4,$5) returning *`,
    [site_id, requested_by || req.user.id, work_type, needed_by, notes || null]
  );
  res.status(201).json(rows[0]);
}));

// Only staff can confirm a schedule — this is the endpoint with real
// business logic: it blocks the schedule if the crew isn't certified.
router.post('/:id/schedule', requireRole('admin', 'manager'), validate(scheduleSchema), asyncHandler(async (req, res) => {
  const { crew_id, scheduled_date } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: reqRows } = await client.query(
      'select * from job_requests where id = $1 for update', [req.params.id]
    );
    const request = reqRows[0];
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
    if (request.status !== 'requested') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Request is already ${request.status}` });
    }

    const canDo = await crewCanDoWorkType(crew_id, request.work_type);
    if (!canDo) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Crew is not certified for "${request.work_type}" work` });
    }

    const { rows: jobRows } = await client.query(
      `insert into jobs (request_id, site_id, crew_id, work_type, scheduled_date)
       values ($1,$2,$3,$4,$5) returning *`,
      [request.id, request.site_id, crew_id, request.work_type, scheduled_date]
    );
    await client.query(`update job_requests set status = 'scheduled' where id = $1`, [request.id]);
    await client.query('COMMIT');
    res.status(201).json(jobRows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;
