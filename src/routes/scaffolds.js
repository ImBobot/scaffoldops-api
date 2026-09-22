const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { scaffoldSchema } = require('../validation/schemas');

router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    select sc.*, j.site_id, s.name as site_name
    from scaffolds sc
    join jobs j on j.id = sc.job_id
    join sites s on s.id = j.site_id
    order by sc.erected_at desc
  `);
  res.json(rows);
}));

// Tag issuance is a supervisor-or-above action.
router.post('/', requireRole('admin', 'manager', 'supervisor'), validate(scaffoldSchema), asyncHandler(async (req, res) => {
  const { job_id, type, latitude, longitude } = req.body;
  const qr_code = 'SC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const { rows } = await pool.query(
    `insert into scaffolds (job_id, qr_code, type, latitude, longitude)
     values ($1,$2,$3,$4,$5) returning *`,
    [job_id, qr_code, type, latitude ?? null, longitude ?? null]
  );
  res.status(201).json(rows[0]);
}));

// A scanned QR tag only gives you the printed code (e.g. "SC-A1B2C3"), not
// the internal UUID — this is what the scan flow actually calls.
router.get('/by-code/:qrCode', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    select sc.*, j.site_id, s.name as site_name
    from scaffolds sc
    join jobs j on j.id = sc.job_id
    join sites s on s.id = j.site_id
    where sc.qr_code = $1
  `, [req.params.qrCode]);
  if (!rows[0]) return res.status(404).json({ error: 'No scaffold found for that tag' });
  const { rows: inspections } = await pool.query(
    'select * from inspections where scaffold_id = $1 order by inspected_at desc',
    [rows[0].id]
  );
  res.json({ ...rows[0], inspections });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('select * from scaffolds where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const { rows: inspections } = await pool.query(
    'select * from inspections where scaffold_id = $1 order by inspected_at desc',
    [req.params.id]
  );
  res.json({ ...rows[0], inspections });
}));

module.exports = router;
