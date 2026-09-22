const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiters');
const { registerSchema, loginSchema } = require('../validation/schemas');

// Public self-signup is allowed ONLY for the 'builder' role (a client
// registering to raise job requests). Any internal role (admin/manager/
// supervisor/worker) can only be created by an existing admin — this runs
// AFTER validate(), so req.body.role is already known-good.
function requireAdminForInternalRoles(req, res, next) {
  if (req.body.role === 'builder') return next();
  return authenticate(req, res, () => requireRole('admin')(req, res, next));
}

router.post(
  '/register',
  validate(registerSchema),
  requireAdminForInternalRoles,
  asyncHandler(async (req, res) => {
    const { company_id, role, full_name, email, phone, password } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `insert into users (company_id, role, full_name, email, phone, password_hash)
       values ($1,$2,$3,$4,$5,$6)
       returning id, role, full_name, email, company_id`,
      [company_id || null, role, full_name, email, phone || null, password_hash]
    );
    res.status(201).json(rows[0]);
  })
);

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('select * from users where email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: user.id, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, user: { id: user.id, role: user.role, full_name: user.full_name, email: user.email } });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'select id, role, full_name, email, company_id from users where id = $1',
    [req.user.id]
  );
  res.json(rows[0]);
}));

module.exports = router;
