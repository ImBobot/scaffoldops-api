const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { documentSchema } = require('../validation/schemas');

// Any authenticated user can attach a document to their own inspection/
// handover/etc. — the file itself is assumed already uploaded client-side
// to private cloud storage; this just records the pointer.
router.use(authenticate);

router.post('/', validate(documentSchema), asyncHandler(async (req, res) => {
  const { owner_type, owner_id, doc_type, file_url, uploaded_by } = req.body;
  const { rows } = await pool.query(
    `insert into documents (owner_type, owner_id, doc_type, file_url, uploaded_by)
     values ($1,$2,$3,$4,$5) returning *`,
    [owner_type, owner_id, doc_type, file_url, uploaded_by || req.user.id]
  );
  res.status(201).json(rows[0]);
}));

router.get('/:ownerType/:ownerId', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'select * from documents where owner_type = $1 and owner_id = $2 order by created_at desc',
    [req.params.ownerType, req.params.ownerId]
  );
  res.json(rows);
}));

module.exports = router;
