const pool = require('../db/pool');

// Mirrors the CERT_RANK logic from the prototype: basic=1, advanced=2, supervisor=3
async function crewMaxCertLevel(crewId) {
  const { rows } = await pool.query(
    `select coalesce(max(
       case c.level when 'supervisor' then 3 when 'advanced' then 2 else 1 end
     ), 0) as max_rank
     from crew_members cm
     join workers w on w.id = cm.worker_id
     join certifications c on c.worker_id = w.id
     where cm.crew_id = $1
       and (c.expiry_date is null or c.expiry_date >= current_date)`,
    [crewId]
  );
  return Number(rows[0].max_rank);
}

function rankForWorkType(workType) {
  return workType === 'advanced' ? 2 : 1;
}

async function crewCanDoWorkType(crewId, workType) {
  const maxRank = await crewMaxCertLevel(crewId);
  return maxRank >= rankForWorkType(workType);
}

module.exports = { crewMaxCertLevel, crewCanDoWorkType, rankForWorkType };
