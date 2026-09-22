const router = require('express').Router();

router.use('/companies', require('./companies'));
router.use('/users', require('./users'));
router.use('/workers', require('./workers'));
router.use('/certifications', require('./certifications'));
router.use('/crews', require('./crews'));
router.use('/sites', require('./sites'));
router.use('/job-requests', require('./jobRequests'));
router.use('/jobs', require('./jobs'));
router.use('/materials', require('./materials'));
router.use('/scaffolds', require('./scaffolds'));
router.use('/inspections', require('./inspections'));
router.use('/handovers', require('./handovers'));
router.use('/documents', require('./documents'));
router.use('/dashboard', require('./dashboard'));

module.exports = router;
