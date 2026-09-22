const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { handoverSchema } = require('../validation/schemas');

router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('select * from handovers order by handed_over_at desc');
  res.json(rows);
}));

// Only a green-tagged scaffold can be handed over.
router.post('/', validate(handoverSchema), asyncHandler(async (req, res) => {
  const { scaffold_id, job_id, handed_over_by, issued_to_name, issued_to_user_id } = req.body;
  const { rows: scRows } = await pool.query('select status from scaffolds where id = $1', [scaffold_id]);
  if (!scRows[0]) return res.status(404).json({ error: 'Scaffold not found' });
  if (scRows[0].status !== 'green') {
    return res.status(409).json({ error: 'Scaffold is not tagged green — cannot hand over' });
  }
  const { rows } = await pool.query(
    `insert into handovers (scaffold_id, job_id, handed_over_by, issued_to_name, issued_to_user_id)
     values ($1,$2,$3,$4,$5) returning *`,
    [scaffold_id, job_id, handed_over_by, issued_to_name, issued_to_user_id || null]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
