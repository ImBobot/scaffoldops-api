const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { companySchema } = require('../validation/schemas');

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('select * from companies order by name');
  res.json(rows);
}));

router.post('/', requireRole('admin', 'manager'), validate(companySchema), asyncHandler(async (req, res) => {
  const { name, type, address, phone } = req.body;
  const { rows } = await pool.query(
    `insert into companies (name, type, address, phone) values ($1,$2,$3,$4) returning *`,
    [name, type, address || null, phone || null]
  );
  res.status(201).json(rows[0]);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('select * from companies where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

module.exports = router;
