const MAX_TEXT_LENGTH = 500;
const MAX_OPTION_LENGTH = 200;
const MAX_TOPIC_LENGTH = 100;
const OPTION_COUNT = 4;
const DIFFICULTIES = Object.freeze(['Easy', 'Medium', 'Hard']);

function textField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Accepts 'easy', 'EASY' or 'Easy' and returns the stored spelling, or null for anything else.
function normalizeDifficulty(value) {
  const lower = textField(value).toLowerCase();
  return DIFFICULTIES.find(difficulty => difficulty.toLowerCase() === lower) || null;
}

// Options are either four strings with a separate correctIndex, or four { text, isCorrect } objects.
function readOptions(options, correctIndex) {
  if (!Array.isArray(options) || options.length !== OPTION_COUNT) {
    return { error: 'Exactly four options are required' };
  }

  const asObjects = options.every(option => option && typeof option === 'object' && !Array.isArray(option));
  const asStrings = options.every(option => typeof option === 'string');
  if (!asObjects && !asStrings) return { error: 'Options must be text' };

  const texts = options.map(option => textField(asObjects ? option.text : option));
  if (texts.some(text => !text)) return { error: 'Options must not be empty' };
  if (texts.some(text => text.length > MAX_OPTION_LENGTH)) return { error: 'Options must not exceed 200 characters' };
  if (new Set(texts.map(text => text.toLowerCase())).size !== OPTION_COUNT) return { error: 'Options must be different' };

  let index = correctIndex;
  if (asObjects) {
    const correct = options.map((option, i) => (option.isCorrect === true ? i : -1)).filter(i => i !== -1);
    index = correct.length === 1 ? correct[0] : undefined;
  }
  if (!Number.isInteger(index) || index < 0 || index >= OPTION_COUNT) {
    return { error: 'Exactly one correct option is required' };
  }

  return { value: { options: texts, correctIndex: index } };
}

function validateQuestionInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body is required' };
  }

  const text = textField(body.text);
  if (!text) return { error: 'Question text is required' };
  if (text.length > MAX_TEXT_LENGTH) return { error: 'Question text must not exceed 500 characters' };

  const options = readOptions(body.options, body.correctIndex);
  if (options.error) return options;

  const topic = textField(body.topic);
  if (!topic) return { error: 'Topic is required' };
  if (topic.length > MAX_TOPIC_LENGTH) return { error: 'Topic must not exceed 100 characters' };

  if (!textField(body.difficulty)) return { error: 'Difficulty is required' };
  const difficulty = normalizeDifficulty(body.difficulty);
  if (!difficulty) return { error: 'Difficulty must be Easy, Medium or Hard' };

  return { value: { text, ...options.value, topic, difficulty } };
}

// Turns ?topic=&difficulty= into a MongoDB filter; either, both or neither may be given.
function parseQuestionFilter(query = {}) {
  const topic = textField(query.topic);
  const rawDifficulty = textField(query.difficulty);
  const filter = {};

  if (topic.length > MAX_TOPIC_LENGTH) return { error: 'Topic must not exceed 100 characters' };
  if (topic) filter.topicKey = topic.toLowerCase();

  if (rawDifficulty) {
    const difficulty = normalizeDifficulty(rawDifficulty);
    if (!difficulty) return { error: 'Difficulty must be Easy, Medium or Hard' };
    filter.difficulty = difficulty;
  }

  return { value: filter };
}

module.exports = { MAX_TEXT_LENGTH, OPTION_COUNT, DIFFICULTIES, normalizeDifficulty, validateQuestionInput, parseQuestionFilter };
