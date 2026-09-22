// Generic body-validation middleware built on zod schemas. On failure it
// responds 400 with a field-by-field breakdown instead of letting a bad
// request reach the database and throw an ugly SQL error.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data; // parsed + defaults applied
    next();
  };
}

module.exports = validate;
