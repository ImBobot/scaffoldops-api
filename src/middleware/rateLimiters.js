const rateLimit = require('express-rate-limit');

// 10 attempts per 15 minutes per IP — enough for a genuine forgotten
// password, not enough for a brute-force script.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

module.exports = { loginLimiter };
