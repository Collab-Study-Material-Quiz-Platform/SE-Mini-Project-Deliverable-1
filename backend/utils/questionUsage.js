const mongoose = require('mongoose');

// Quizzes are stored in the `quizzes` collection (the default collection of a Mongoose `Quiz` model) with
// `status` and `questionIds` fields, as defined in the SAD data design. Reading the collection directly keeps
// the question bank independent of the quiz module.
async function isQuestionInPublishedQuiz(questionId) {
  const id = new mongoose.Types.ObjectId(String(questionId));
  const quiz = await mongoose.connection.collection('quizzes').findOne(
    { status: 'published', questionIds: { $in: [id, id.toString()] } },
    { projection: { _id: 1 } }
  );
  return Boolean(quiz);
}

module.exports = { isQuestionInPublishedQuiz };
