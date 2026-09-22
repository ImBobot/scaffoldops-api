const router = require('express').Router();
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');

// Manager's cross-site overview — not for builders or base crew.
router.use(authenticate, requireRole('admin', 'manager'));

router.get('/summary', asyncHandler(async (req, res) => {
  const [openReq, jobCount, tagCounts, shortfallJobs] = await Promise.all([
    pool.query(`select count(*)::int as n from job_requests where status = 'requested'`),
    pool.query(`select count(*)::int as n from jobs where status in ('scheduled','in_progress')`),
    pool.query(`select status, count(*)::int as n from scaffolds group by status`),
    pool.query(`
      select count(distinct jm.job_id)::int as n
      from job_materials jm
      join materials m on m.id = jm.material_id
      where m.qty_on_hand < jm.qty_required
    `)
  ]);

  const byStatus = { green: 0, yellow: 0, red: 0 };
  tagCounts.rows.forEach(r => { byStatus[r.status] = r.n; });

  res.json({
    open_requests: openReq.rows[0].n,
    active_jobs: jobCount.rows[0].n,
    scaffolds_by_status: byStatus,
    jobs_with_shortfalls: shortfallJobs.rows[0].n
  });
}));

module.exports = router;
