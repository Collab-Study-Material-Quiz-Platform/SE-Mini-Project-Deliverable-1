const MAX_TITLE_LENGTH = 100;
const MAX_LABEL_LENGTH = 100;

function textField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateMaterialInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Title, subject and topic are required' };
  }

  const title = textField(body.title);
  const subject = textField(body.subject);
  const topic = textField(body.topic);

  if (!title) return { error: 'Title is required' };
  if (title.length > MAX_TITLE_LENGTH) return { error: 'Title must not exceed 100 characters' };
  if (!subject) return { error: 'Subject is required' };
  if (subject.length > MAX_LABEL_LENGTH) return { error: 'Subject must not exceed 100 characters' };
  if (!topic) return { error: 'Topic is required' };
  if (topic.length > MAX_LABEL_LENGTH) return { error: 'Topic must not exceed 100 characters' };

  return { value: { title, subject, topic } };
}

// Turns ?q=&subject=&topic=&page= into a MongoDB filter. Subject and topic match exactly, ignoring case.
function parseMaterialSearch(query = {}) {
  const keyword = textField(query.q);
  const subject = textField(query.subject);
  const topic = textField(query.topic);
  const rawPage = query.page == null || query.page === '' ? '1' : query.page;

  if (typeof rawPage !== 'string' || !/^\d+$/.test(rawPage) || Number(rawPage) < 1) {
    return { error: 'Page must be a positive whole number' };
  }
  if (keyword.length > 200 || subject.length > MAX_LABEL_LENGTH || topic.length > MAX_LABEL_LENGTH) {
    return { error: 'Search terms are too long' };
  }

  const filter = {};
  if (keyword) filter.$text = { $search: keyword };
  if (subject) filter.subjectKey = subject.toLowerCase();
  if (topic) filter.topicKey = topic.toLowerCase();

  return { value: { filter, page: Number(rawPage) } };
}

module.exports = { MAX_TITLE_LENGTH, MAX_LABEL_LENGTH, validateMaterialInput, parseMaterialSearch };
