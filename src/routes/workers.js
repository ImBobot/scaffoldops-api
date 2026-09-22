const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { workerSchema } = require('../validation/schemas');

const CURRENT_CERT_SUBQUERY = `(
  select c.level from certifications c
  where c.worker_id = w.id
    and (c.expiry_date is null or c.expiry_date >= current_date)
  order by case c.level when 'supervisor' then 3 when 'advanced' then 2 else 1 end desc
  limit 1
) as current_cert`;

// Internal roster data — never exposed to a builder account.
router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `select w.*, ${CURRENT_CERT_SUBQUERY} from workers w order by w.full_name`
  );
  res.json(rows);
}));

router.post('/', requireRole('admin', 'manager'), validate(workerSchema), asyncHandler(async (req, res) => {
  const { user_id, contractor_id, full_name, phone } = req.body;
  const { rows } = await pool.query(
    `insert into workers (user_id, contractor_id, full_name, phone)
     values ($1,$2,$3,$4) returning *`,
    [user_id || null, contractor_id, full_name, phone || null]
  );
  res.status(201).json(rows[0]);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `select w.*, ${CURRENT_CERT_SUBQUERY} from workers w where w.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

module.exports = router;
