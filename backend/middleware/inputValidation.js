const UNSAFE_TEXT = /<\s*script\b|javascript\s*:|on(?:error|load|click)\s*=|(?:\$\s*(?:where|gt|gte|lt|lte|ne|in|nin|regex|exists))|(?:\bunion\s+select\b|\bdrop\s+table\b|\binsert\s+into\b|\bdelete\s+from\b)/i;
const UNSAFE_KEY = /^\$(?:where|gt|gte|lt|lte|ne|in|nin|regex|exists)$/i;

function containsUnsafeInput(value) {
  if (typeof value === 'string') return UNSAFE_TEXT.test(value);
  if (Array.isArray(value)) return value.some(containsUnsafeInput);
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, child]) => UNSAFE_KEY.test(key) || containsUnsafeInput(child));
  }
  return false;
}

function rejectUnsafeInput(req, res, next) {
  if (containsUnsafeInput(req.body) || containsUnsafeInput(req.query) || containsUnsafeInput(req.params)) {
    return res.status(400).json({ message: 'Invalid input' });
  }
  return next();
}

module.exports = { containsUnsafeInput, rejectUnsafeInput };
