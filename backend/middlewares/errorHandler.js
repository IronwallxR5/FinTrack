const errorHandler = (err, _req, res, _next) => {
  console.error(`[ERROR] ${err.message}`);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON in request body." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body is too large." });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode < 500 ? err.message : "Internal Server Error",
  });
};

module.exports = errorHandler;
