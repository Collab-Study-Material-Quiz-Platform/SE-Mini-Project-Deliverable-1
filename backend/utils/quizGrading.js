function readAnswer(answers, questionId) {
  const selected = answers instanceof Map ? answers.get(questionId) : answers?.[questionId];
  return Number.isInteger(selected) ? selected : null;
}

// Grades an attempt: 1 mark for each correct answer and 0 for each wrong or unanswered question (CSQ-F-032).
// `questionIds` is the quiz order and sets the total, so a question that no longer exists still counts as 0 marks.
function gradeAttempt(questionIds, questions, answers, gradedAt = new Date()) {
  const questionsById = new Map(questions.map(question => [question._id.toString(), question]));

  const results = questionIds.map((id) => {
    const questionId = id.toString();
    const question = questionsById.get(questionId);
    const selectedIndex = readAnswer(answers, questionId);
    if (!question) {
      return { questionId: id, text: 'This question is no longer available', options: [], selectedIndex, correctIndex: null, correct: false, topic: '' };
    }
    return {
      questionId: id,
      text: question.text,
      options: question.options,
      selectedIndex,
      correctIndex: question.correctIndex,
      correct: selectedIndex === question.correctIndex,
      topic: question.topic,
    };
  });

  const score = results.filter(result => result.correct).length;
  const total = results.length;
  const percentage = total === 0 ? 0 : Math.round((score / total) * 1000) / 10;

  return { score, total, percentage, gradedAt, questions: results };
}

module.exports = { gradeAttempt };
