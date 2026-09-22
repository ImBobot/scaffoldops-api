const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { materialSchema, stockAdjustSchema } = require('../validation/schemas');

router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('select * from materials order by name');
  res.json(rows);
}));

router.post('/', requireRole('admin', 'manager'), validate(materialSchema), asyncHandler(async (req, res) => {
  const { contractor_id, name, unit, qty_on_hand, reorder_threshold } = req.body;
  const { rows } = await pool.query(
    `insert into materials (contractor_id, name, unit, qty_on_hand, reorder_threshold)
     values ($1,$2,$3,$4,$5) returning *`,
    [contractor_id, name, unit, qty_on_hand, reorder_threshold]
  );
  res.status(201).json(rows[0]);
}));

router.patch('/:id/stock', requireRole('admin', 'manager'), validate(stockAdjustSchema), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `update materials set qty_on_hand = qty_on_hand + $1 where id = $2 returning *`,
    [req.body.delta, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

module.exports = router;
