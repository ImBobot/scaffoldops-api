const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole, INTERNAL_ROLES } = require('../middleware/auth');
const { certificationSchema } = require('../validation/schemas');

router.use(authenticate, requireRole(...INTERNAL_ROLES));

router.get('/worker/:workerId', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `select * from certifications where worker_id = $1 order by issued_date desc`,
    [req.params.workerId]
  );
  res.json(rows);
}));

// Only an admin/manager can add a certification — a worker shouldn't be
// able to grant themselves a higher cert level.
router.post('/', requireRole('admin', 'manager'), validate(certificationSchema), asyncHandler(async (req, res) => {
  const { worker_id, level, issuing_body, cert_number, issued_date, expiry_date, document_id } = req.body;
  const { rows } = await pool.query(
    `insert into certifications (worker_id, level, issuing_body, cert_number, issued_date, expiry_date, document_id)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [worker_id, level, issuing_body || null, cert_number || null, issued_date, expiry_date || null, document_id || null]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
