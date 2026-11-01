function toAttemptResponse(attempt, serverTime = new Date(), serverProcessingMs = 0) {
  return {
    id: attempt._id,
    quizId: attempt.quizId,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
    answers: Object.fromEntries(attempt.answers || []),
    serverTime,
    serverProcessingMs,
  };
}

function toAttemptQuestion(question) {
  return {
    id: question._id,
    text: question.text,
    options: question.options,
    topic: question.topic,
    difficulty: question.difficulty,
  };
}

module.exports = { toAttemptResponse, toAttemptQuestion };
