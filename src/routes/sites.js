const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { siteSchema } = require('../validation/schemas');

// Open to any authenticated user (including builders) — a builder needs to
// register their own site before raising a job request against it.
// TODO once multi-tenant: scope GET to req.user.company_id for builder roles.
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('select * from sites order by created_at desc');
  res.json(rows);
}));

router.post('/', validate(siteSchema), asyncHandler(async (req, res) => {
  const { company_id, name, address, latitude, longitude } = req.body;
  const { rows } = await pool.query(
    `insert into sites (company_id, name, address, latitude, longitude)
     values ($1,$2,$3,$4,$5) returning *`,
    [company_id, name, address, latitude ?? null, longitude ?? null]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
