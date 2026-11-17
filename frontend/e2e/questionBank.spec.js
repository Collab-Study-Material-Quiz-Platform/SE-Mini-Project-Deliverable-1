import { expect, test } from '@playwright/test'
import { API, auth, createAccount, createPublishedQuiz, createQuestions, logIn, unique } from './support/app.js'
import { db } from './support/backend.js'

function addForm(page) {
  return page.getByRole('form', { name: /^(Add a question|Edit question)$/ })
}

async function fillQuestion(form, { text, options = ['1', '2', '3', '4'], correct = 'B', topic = 'Algebra', difficulty = 'Easy' }) {
  await form.getByLabel('Question text').fill(text)
  for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) await form.getByLabel(label, { exact: true }).fill(options[i])
  await form.getByLabel(`Option ${correct} is correct`).check()
  await form.getByLabel('Topic').fill(topic)
  await form.getByLabel('Difficulty').selectOption(difficulty)
}

test.describe('Question bank', () => {
  test('TC-QB-01: a 500-character question with 4 options and 1 correct answer is saved; 3 options or 2 correct are rejected', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    await logIn(page, contributor.email, contributor.password)
    await page.goto('/#/questions')

    const text = `${unique('Q')} ${'x'.repeat(480)}`.slice(0, 500)
    await fillQuestion(addForm(page), { text })
    await addForm(page).getByRole('button', { name: 'Save question' }).click()
    await expect(addForm(page).getByRole('status')).toHaveText('Question saved to the question bank.')
    await expect(page.getByText(text)).toBeVisible()
    const stored = await (await db()).collection('questions').findOne({ text })
    expect(stored.options).toHaveLength(4)
    expect(stored.correctIndex).toBe(1)

    // The form always has four options and one radio choice, so the invalid shapes are sent to the API directly.
    const threeOptions = await request.post(`${API}/questions`, {
      headers: auth(contributor.token), data: { text: 'Three options', options: ['1', '2', '3'], correctIndex: 0, topic: 'Algebra', difficulty: 'Easy' },
    })
    expect(threeOptions.status()).toBe(400)
    expect((await threeOptions.json()).message).toBe('Exactly four options are required')
    const twoCorrect = await request.post(`${API}/questions`, {
      headers: auth(contributor.token),
      data: { text: 'Two correct', options: ['1', '2', '3', '4'].map((option, i) => ({ text: option, isCorrect: i < 2 })), topic: 'Algebra', difficulty: 'Easy' },
    })
    expect(twoCorrect.status()).toBe(400)
    expect((await twoCorrect.json()).message).toBe('Exactly one correct option is required')
  })

  test('TC-QB-02: own questions can be edited and deleted; another contributor gets "Access denied"; a question in a published quiz is "in use"', async ({ page, request }) => {
    const owner = await createAccount(request, 'contributor')
    const other = await createAccount(request, 'contributor')
    const label = unique('own')
    const questions = await createQuestions(request, owner.token, 6, { label })
    await createPublishedQuiz(request, owner.token, questions.slice(1))

    await logIn(page, owner.email, owner.password)
    await page.goto('/#/questions')
    const first = page.getByRole('listitem').filter({ hasText: `${label} question 1` }).first()
    await first.getByRole('button', { name: 'Edit' }).click()
    await addForm(page).getByLabel('Question text').fill(`${label} question 1 edited`)
    await addForm(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Question updated.')).toBeVisible()
    await expect(page.getByText(`${label} question 1 edited`)).toBeVisible()

    page.on('dialog', dialog => dialog.accept())
    const inUse = page.getByRole('listitem').filter({ hasText: `${label} question 2` }).first()
    await inUse.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('alert')).toHaveText('Question is in use')

    await page.getByRole('listitem').filter({ hasText: `${label} question 1 edited` }).first().getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Question deleted.')).toBeVisible()
    expect(await (await db()).collection('questions').countDocuments({ text: `${label} question 1 edited` })).toBe(0)

    // Another contributor sees the question but no edit or delete buttons, and the server refuses both.
    await page.getByRole('button', { name: 'Log out' }).click()
    await logIn(page, other.email, other.password)
    await page.goto('/#/questions')
    const foreign = page.getByRole('listitem').filter({ hasText: `${label} question 3` }).first()
    await expect(foreign).toBeVisible()
    await expect(foreign.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    for (const method of ['put', 'delete']) {
      const response = await request[method](`${API}/questions/${questions[2].id}`, {
        headers: auth(other.token),
        data: method === 'put' ? { text: 'Hijacked', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Algebra', difficulty: 'Easy' } : undefined,
      })
      expect(response.status()).toBe(403)
      expect((await response.json()).message).toBe('Access denied')
    }
  })

  test('TC-QB-03: a question needs a topic and difficulty, and filtering by Algebra and Easy returns only matching questions', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const algebra = unique('Algebra')
    const geometry = unique('Geometry')
    for (const topic of [algebra, geometry]) {
      for (const difficulty of ['Easy', 'Medium', 'Hard']) {
        await createQuestions(request, contributor.token, 1, { topic, difficulty, label: `${topic} ${difficulty}` })
      }
    }
    const missingDifficulty = await request.post(`${API}/questions`, {
      headers: auth(contributor.token), data: { text: 'No difficulty', options: ['1', '2', '3', '4'], correctIndex: 0, topic: algebra },
    })
    expect((await missingDifficulty.json()).message).toBe('Difficulty is required')

    await logIn(page, contributor.email, contributor.password)
    await page.goto('/#/questions')
    // The browser itself blocks saving without a topic.
    await fillQuestion(addForm(page), { text: 'No topic', topic: '' })
    await addForm(page).getByRole('button', { name: 'Save question' }).click()
    expect(await addForm(page).getByLabel('Topic').evaluate(input => input.validity.valueMissing)).toBe(true)

    const filters = page.getByRole('form', { name: 'Filter questions' })
    await filters.getByLabel('Topic').fill(algebra.toLowerCase())
    await filters.getByLabel('Difficulty').selectOption('Easy')
    await filters.getByRole('button', { name: 'Filter' }).click()
    await expect(page.getByText('(1 matching)')).toBeVisible()
    await expect(page.locator('.qb-item')).toHaveCount(1)
    await expect(page.locator('.qb-item')).toContainText(`${algebra} Easy question 1`)

    await filters.getByLabel('Topic').fill('')
    await filters.getByRole('button', { name: 'Filter' }).click()
    await expect(page.locator('.qb-item .difficulty-easy').first()).toBeVisible()
    for (const tag of await page.locator('.qb-item .qb-tag[class*="difficulty-"]').allTextContents()) expect(tag).toBe('Easy')
  })
})
