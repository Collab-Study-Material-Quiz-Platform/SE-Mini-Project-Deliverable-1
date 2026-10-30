function validateQuizInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body is required' };
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const timeLimitMinutes = body.timeLimitMinutes;
  const questionIds = body.questionIds;

  if (!title || title.length > 200) return { error: 'Quiz title is required and must not exceed 200 characters' };
  if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 5 || timeLimitMinutes > 180) {
    return { error: 'Time limit must be between 5 and 180 minutes' };
  }
  if (!Array.isArray(questionIds) || questionIds.length < 5 || questionIds.length > 50) {
    return { error: 'Quiz must contain 5 to 50 questions' };
  }
  if (new Set(questionIds).size !== questionIds.length || questionIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
    return { error: 'Question IDs must be valid and unique' };
  }
  return { value: { title, timeLimitMinutes, questionIds } };
}

module.exports = { validateQuizInput };
