const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { materialShortfallForJob } = require('../utils/materials');
const { jobMaterialSchema } = require('../validation/schemas');

router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    select j.*, s.name as site_name, cr.name as crew_name
    from jobs j
    join sites s on s.id = j.site_id
    join crews cr on cr.id = j.crew_id
    order by j.scheduled_date desc
  `);
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    select j.*, s.name as site_name, s.address as site_address, cr.name as crew_name
    from jobs j
    join sites s on s.id = j.site_id
    join crews cr on cr.id = j.crew_id
    where j.id = $1
  `, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

router.get('/:id/materials-check', asyncHandler(async (req, res) => {
  const shortfall = await materialShortfallForJob(req.params.id);
  res.json({ items: shortfall, ready: shortfall.every(i => i.ok) });
}));

router.post('/:id/materials', requireRole('admin', 'manager'), validate(jobMaterialSchema), asyncHandler(async (req, res) => {
  const { material_id, qty_required } = req.body;
  const { rows } = await pool.query(
    `insert into job_materials (job_id, material_id, qty_required)
     values ($1,$2,$3)
     on conflict (job_id, material_id) do update set qty_required = excluded.qty_required
     returning *`,
    [req.params.id, material_id, qty_required]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
