import { expect, test } from '@playwright/test'
import { API, apiLogin, auth, correctly, createAccount, createPublishedQuiz, createQuestions, logIn, takeQuiz, unique, uploadMaterial, wrongly } from './support/app.js'
import { ADMIN } from './support/backend.js'

test.describe('Performance reports and moderation', () => {
  test('TC-Rep-01: a student sees an overall average, topic scores and attempts that match a manual calculation', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const algebraTopic = unique('Algebra')
    const geometryTopic = unique('Geometry')
    const algebra = await createQuestions(request, contributor.token, 5, { topic: algebraTopic })
    const geometry = await createQuestions(request, contributor.token, 5, { topic: geometryTopic })
    const algebraQuiz = await createPublishedQuiz(request, contributor.token, algebra, { title: unique('Algebra quiz ') })
    const geometryQuiz = await createPublishedQuiz(request, contributor.token, geometry, { title: unique('Geometry quiz ') })
    const student = await createAccount(request, 'student')

    // Attempt 1: algebra 4/5 = 80%. Attempt 2: algebra 2/5 = 40% (3 wrong). Attempt 3: geometry 3/5 = 60% (2 unanswered).
    await takeQuiz(request, student.token, algebraQuiz, algebra, (q, i) => (i < 4 ? correctly(q) : wrongly(q)))
    await takeQuiz(request, student.token, algebraQuiz, algebra, (q, i) => (i < 2 ? correctly(q) : wrongly(q)))
    await takeQuiz(request, student.token, geometryQuiz, geometry, (q, i) => (i < 3 ? correctly(q) : null))

    // Manual calculation: overall = (80 + 40 + 60) / 3 = 60%. Algebra = 6 correct of 10 answered = 60%.
    // Geometry = 3 correct of 3 answered = 100% (unanswered questions are not counted per topic).
    await logIn(page, student.email, student.password)
    await page.goto('/#/performance')
    await expect(page.locator('.perf-avg-value')).toHaveText('60%')
    await expect(page.getByText('Across 3 attempts')).toBeVisible()
    const topics = page.getByRole('table', { name: 'Score by topic' })
    await expect(topics.getByRole('row').filter({ hasText: algebraTopic })).toContainText('6/10 (60%)')
    await expect(topics.getByRole('row').filter({ hasText: geometryTopic })).toContainText('3/3 (100%)')
    const attempts = page.getByRole('table', { name: 'Recent quiz attempts' }).getByRole('row')
    await expect(attempts).toHaveCount(4)
    await expect(attempts.nth(1)).toContainText(`${geometryQuiz.title}`)
    await expect(attempts.nth(1)).toContainText('3/5 (60%)')
    await expect(attempts.nth(3)).toContainText('4/5 (80%)')
  })

  test('TC-Rep-02: a contributor sees attempts, average, highest, lowest and the 3 hardest questions for own quizzes only', async ({ page, request }) => {
    const owner = await createAccount(request, 'contributor')
    const other = await createAccount(request, 'contributor')
    const label = unique('stats')
    const questions = await createQuestions(request, owner.token, 5, { label })
    const quiz = await createPublishedQuiz(request, owner.token, questions, { title: unique('Stats quiz ') })
    const othersQuiz = await createPublishedQuiz(request, other.token, await createQuestions(request, other.token, 5), { title: unique('Not mine ') })

    // Five students answer the first k questions correctly, k = 5, 4, 3, 2, 1 -> scores 5, 4, 3, 2, 1.
    // Manual calculation: average 3, highest 5, lowest 1. Question n is correct in 6 - n attempts, so the
    // hardest are question 5 (1/5 = 20%), question 4 (2/5 = 40%) and question 3 (3/5 = 60%).
    for (const k of [5, 4, 3, 2, 1]) {
      const student = await createAccount(request, 'student')
      await takeQuiz(request, student.token, quiz, questions, (q, i) => (i < k ? correctly(q) : wrongly(q)))
    }

    await logIn(page, owner.email, owner.password)
    await page.goto('/#/performance')
    const card = page.getByRole('article', { name: `Statistics for ${quiz.title}` })
    await expect(card.locator('.contrib-metric-num')).toHaveText(['5', '3', '5', '1'])
    await expect(card.locator('.contrib-hardest-text')).toHaveText([`${label} question 5`, `${label} question 4`, `${label} question 3`])
    await expect(card.locator('.contrib-hardest-stat')).toHaveText(['1/5 correct (20%)', '2/5 correct (40%)', '3/5 correct (60%)'])
    await expect(page.getByRole('article', { name: `Statistics for ${othersQuiz.title}` })).toHaveCount(0)
  })

  test('TC-Adm-01: an admin removes a material and a quiz; students no longer find either', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const title = unique('Inappropriate notes ')
    await uploadMaterial(request, contributor.token, { title })
    const quiz = await createPublishedQuiz(request, contributor.token, await createQuestions(request, contributor.token, 5), { title: unique('Inappropriate quiz ') })

    await logIn(page, ADMIN.email, ADMIN.password)
    await page.goto('/#/admin')
    page.on('dialog', dialog => dialog.accept())
    const materialCard = page.getByRole('article').filter({ hasText: title })
    await materialCard.getByRole('button', { name: 'Delete' }).click()
    await expect(materialCard).toHaveCount(0)
    const quizCard = page.getByRole('article').filter({ hasText: quiz.title })
    await quizCard.getByRole('button', { name: 'Delete' }).click()
    await expect(quizCard).toHaveCount(0)

    const student = await createAccount(request, 'student')
    const search = await (await request.get(`${API}/materials?q=${encodeURIComponent(title.split(' ')[1])}`, { headers: auth(student.token) })).json()
    expect(search.total).toBe(0)
    await page.getByRole('button', { name: 'Log out' }).click()
    await logIn(page, student.email, student.password)
    await page.goto('/#/quizzes')
    await expect(page.getByRole('heading', { name: 'Published quizzes' })).toBeVisible()
    await expect(page.getByRole('article').filter({ hasText: quiz.title })).toHaveCount(0)

    // A contributor may remove their own material but not another contributor's.
    const own = await uploadMaterial(request, contributor.token, { title: unique('Own notes ') })
    const otherContributor = await createAccount(request, 'contributor')
    expect((await request.delete(`${API}/materials/${own.id}`, { headers: auth(otherContributor.token) })).status()).toBe(403)
    expect((await request.delete(`${API}/materials/${own.id}`, { headers: auth(contributor.token) })).status()).toBe(200)
    expect((await apiLogin(request, ADMIN.email, ADMIN.password)).user.role).toBe('admin')
  })
})
