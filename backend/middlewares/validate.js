const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidUUID = (v) => typeof v === "string" && UUID_RE.test(v);
const isValidEmail = (v) => typeof v === "string" && EMAIL_RE.test(v);
const isValidDate = (v) => {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
};

const validateIdParam = (req, res, next) => {
  for (const [key, value] of Object.entries(req.params)) {
    if (key === "id" && !isValidUUID(value)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${key} format. Must be a valid UUID.`,
      });
    }
  }
  next();
};

module.exports = {
  isValidUUID,
  isValidEmail,
  isValidDate,
  validateIdParam,
};
