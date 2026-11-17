import { expect, test } from '@playwright/test'
import { API, auth, createAccount, createPublishedQuiz, createQuestions, logIn, unique } from './support/app.js'
import { db, mongoose } from './support/backend.js'

function timerSeconds(text) {
  const [, minutes, seconds] = text.match(/(\d{2}):(\d{2})/)
  return Number(minutes) * 60 + Number(seconds)
}

test.describe('Quizzes', () => {
  test('TC-Quiz-01: quizzes with 5-50 questions and 5-180 minutes are accepted; 4/51 questions and 4/181 minutes are rejected', async ({ request }) => {
    // There is no Quiz Builder page in the client (deviation), so CSQ-F-030 is validated through its API.
    const contributor = await createAccount(request, 'contributor')
    const questions = await createQuestions(request, contributor.token, 51)
    const ids = questions.map(question => question.id)
    const create = data => request.post(`${API}/quizzes`, { headers: auth(contributor.token), data: { title: unique('Boundary '), ...data } })

    for (const [count, minutes] of [[5, 5], [50, 180]]) {
      const response = await create({ questionIds: ids.slice(0, count), timeLimitMinutes: minutes })
      expect(response.status(), `${count} questions, ${minutes} minutes`).toBe(201)
      expect((await response.json()).quiz).toMatchObject({ status: 'draft', questionCount: count })
    }
    for (const count of [4, 51]) {
      const response = await create({ questionIds: ids.slice(0, count), timeLimitMinutes: 10 })
      expect(response.status()).toBe(400)
      expect((await response.json()).message).toBe('Quiz must contain 5 to 50 questions')
    }
    for (const minutes of [4, 181]) {
      const response = await create({ questionIds: ids.slice(0, 5), timeLimitMinutes: minutes })
      expect(response.status()).toBe(400)
      expect((await response.json()).message).toBe('Time limit must be between 5 and 180 minutes')
    }

    const draft = await (await create({ questionIds: ids.slice(0, 5), timeLimitMinutes: 15 })).json()
    const student = await createAccount(request, 'student')
    const listed = async () => (await (await request.get(`${API}/quizzes/published`, { headers: auth(student.token) })).json()).quizzes.map(quiz => quiz.id)
    expect(await listed()).not.toContain(draft.quiz.id)
    expect((await request.post(`${API}/quizzes/${draft.quiz.id}/publish`, { headers: auth(contributor.token) })).status()).toBe(200)
    expect(await listed()).toContain(draft.quiz.id)
  })

  test('TC-Quiz-04: a student sees every published quiz with its title, number of questions and time limit', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const questions = await createQuestions(request, contributor.token, 12)
    const first = await createPublishedQuiz(request, contributor.token, questions.slice(0, 5), { title: unique('Algebra basics '), timeLimitMinutes: 15 })
    const second = await createPublishedQuiz(request, contributor.token, questions, { title: unique('Geometry final '), timeLimitMinutes: 90 })

    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    await page.goto('/#/quizzes')
    await expect(page.getByRole('article').filter({ hasText: first.title })).toContainText('5 questions · 15 minutes')
    await expect(page.getByRole('article').filter({ hasText: second.title })).toContainText('12 questions · 90 minutes')
  })

  test('TC-Quiz-02: the countdown stays within 1 s of server time and answers are submitted automatically at 00:00', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const questions = await createQuestions(request, contributor.token, 5, { label: unique('timer') })
    const quiz = await createPublishedQuiz(request, contributor.token, questions, { timeLimitMinutes: 5 })
    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    await page.goto('/#/quizzes')
    await page.getByRole('article').filter({ hasText: quiz.title }).getByRole('button', { name: 'Start quiz' }).click()
    await expect(page).toHaveURL(/#\/quizzes\/attempt\/[a-f\d]{24}$/)
    const attemptId = page.url().split('/').pop()

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()
    const attempt = await (await db()).collection('quizattempts').findOne({ _id: new mongoose.Types.ObjectId(attemptId) })
    const serverRemaining = (attempt.expiresAt.getTime() - Date.now()) / 1000
    const shown = timerSeconds(await timer.textContent())
    expect(Math.abs(shown - serverRemaining)).toBeLessThanOrEqual(1)

    // Answer one question, then shorten the attempt on the server so it runs out in a few seconds.
    const firstQuestion = page.getByRole('group', { name: new RegExp(questions[0].text) })
    await firstQuestion.getByRole('radio').nth(questions[0].correctIndex).check()
    await expect(firstQuestion.getByRole('radio').nth(questions[0].correctIndex)).toBeChecked()
    await expect(page.getByText('Saving answer…')).toHaveCount(0)
    await (await db()).collection('quizattempts').updateOne({ _id: attempt._id }, { $set: { expiresAt: new Date(Date.now() + 5000) } })
    await page.reload()
    await expect(timer).toContainText(/00:0[0-5]/)

    // Nobody clicks Submit: the result appears on its own once the timer reaches zero.
    await expect(page.getByText('Time ran out, so the answers you had given were submitted automatically.')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.result-scores')).toContainText('1/5')
    const finished = await (await db()).collection('quizattempts').findOne({ _id: attempt._id })
    expect(finished.status).toBe('timed_out')
    expect(finished.result.score).toBe(1)
  })

  test('TC-Quiz-03: 7 correct, 2 wrong and 1 unanswered show 7/10, 70% and every correct answer within 3 s', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const questions = await createQuestions(request, contributor.token, 10, { label: unique('grade') })
    const quiz = await createPublishedQuiz(request, contributor.token, questions)
    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    await page.goto('/#/quizzes')
    await page.getByRole('article').filter({ hasText: quiz.title }).getByRole('button', { name: 'Start quiz' }).click()

    for (const [i, question] of questions.slice(0, 9).entries()) {
      const option = i < 7 ? question.correctIndex : (question.correctIndex + 1) % 4
      const group = page.getByRole('group', { name: new RegExp(`${question.text}$`) })
      await group.getByRole('radio').nth(option).check()
      await expect(group.getByRole('radio').nth(option)).toBeChecked()
      await expect(page.getByText('Saving answer…')).toHaveCount(0)
    }

    const startedAt = Date.now()
    await page.getByRole('button', { name: 'Submit attempt' }).click()
    await expect(page.locator('.result-scores')).toContainText('7/10')
    expect(Date.now() - startedAt).toBeLessThan(3000)
    await expect(page.locator('.result-scores')).toContainText('70%')

    const rows = page.locator('.result-question')
    await expect(rows).toHaveCount(10)
    for (const [i, question] of questions.entries()) {
      const row = rows.nth(i)
      await expect(row).toContainText(i < 7 ? 'Correct' : i < 9 ? 'Wrong' : 'Not answered')
      await expect(row).toContainText(`Correct answer: ${'ABCD'[question.correctIndex]}. ${question.options[question.correctIndex]}`)
    }
  })

  test('TC-Quiz-05: a contributor deletes their own quiz, students no longer see it, and another contributor gets "Access denied"', async ({ page, request }) => {
    const owner = await createAccount(request, 'contributor')
    const other = await createAccount(request, 'contributor')
    const questions = await createQuestions(request, owner.token, 5)
    const quiz = await createPublishedQuiz(request, owner.token, questions, { title: unique('Deletable ') })

    // There is no contributor delete button in the client (deviation), so the deletion uses the API.
    const refused = await request.delete(`${API}/quizzes/${quiz.id}`, { headers: auth(other.token) })
    expect(refused.status()).toBe(403)
    expect((await refused.json()).message).toBe('Access denied')
    const deleted = await request.delete(`${API}/quizzes/${quiz.id}`, { headers: auth(owner.token) })
    expect(deleted.status()).toBe(200)

    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    await page.goto('/#/quizzes')
    await expect(page.getByRole('heading', { name: 'Published quizzes' })).toBeVisible()
    await expect(page.getByRole('article').filter({ hasText: quiz.title })).toHaveCount(0)
    const stored = await (await db()).collection('quizzes').findOne({ _id: new mongoose.Types.ObjectId(quiz.id) })
    expect(stored.status).toBe('removed')
  })
})
