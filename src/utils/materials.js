const pool = require('../db/pool');

async function materialShortfallForJob(jobId) {
  const { rows } = await pool.query(
    `select m.id, m.name, m.unit, m.qty_on_hand, jm.qty_required,
       (m.qty_on_hand >= jm.qty_required) as ok
     from job_materials jm
     join materials m on m.id = jm.material_id
     where jm.job_id = $1`,
    [jobId]
  );
  return rows;
}

module.exports = { materialShortfallForJob };
