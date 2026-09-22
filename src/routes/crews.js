const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { crewMaxCertLevel } = require('../utils/competency');
const { crewSchema, crewMemberSchema } = require('../validation/schemas');

router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    select cr.*, coalesce(json_agg(w.full_name) filter (where w.id is not null), '[]') as members
    from crews cr
    left join crew_members cm on cm.crew_id = cr.id
    left join workers w on w.id = cm.worker_id
    group by cr.id
    order by cr.name
  `);
  res.json(rows);
}));

router.post('/', requireRole('admin', 'manager'), validate(crewSchema), asyncHandler(async (req, res) => {
  const { contractor_id, name } = req.body;
  const { rows } = await pool.query(
    `insert into crews (contractor_id, name) values ($1,$2) returning *`,
    [contractor_id, name]
  );
  res.status(201).json(rows[0]);
}));

router.post('/:id/members', requireRole('admin', 'manager'), validate(crewMemberSchema), asyncHandler(async (req, res) => {
  await pool.query(
    `insert into crew_members (crew_id, worker_id) values ($1,$2)
     on conflict do nothing`,
    [req.params.id, req.body.worker_id]
  );
  res.status(201).json({ ok: true });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    select cr.*, coalesce(json_agg(w.*) filter (where w.id is not null), '[]') as members
    from crews cr
    left join crew_members cm on cm.crew_id = cr.id
    left join workers w on w.id = cm.worker_id
    where cr.id = $1
    group by cr.id
  `, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const max_cert_rank = await crewMaxCertLevel(req.params.id);
  res.json({ ...rows[0], max_cert_rank });
}));

module.exports = router;
