import { expect, test } from '@playwright/test'
import { createAccount, createPublishedQuiz, createQuestions, logIn, nav, unique, uploadMaterial } from './support/app.js'

// TC-Comp-01: runs once per browser engine and viewport width (see the compat-* projects in playwright.config.js).
// Firefox and WebKit stand in for Firefox and Safari; Edge uses the same Chromium engine as Chrome.

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'page is wider than the viewport').toBeLessThanOrEqual(1)
}

test('TC-Comp-01: a student logs in, searches and downloads material, and completes a timed quiz', async ({ page, request }) => {
  const contributor = await createAccount(request, 'contributor')
  const title = unique('Compat notes ')
  await uploadMaterial(request, contributor.token, { title, fileName: 'compat.pdf' })
  const questions = await createQuestions(request, contributor.token, 5, { label: unique('compat') })
  const quiz = await createPublishedQuiz(request, contributor.token, questions, { title: unique('Compat quiz '), timeLimitMinutes: 5 })
  const student = await createAccount(request, 'student')

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Collaborative Study Material/ })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await logIn(page, student.email, student.password)
  await expect(nav(page).getByRole('link', { name: 'Materials' })).toBeVisible()

  await nav(page).getByRole('link', { name: 'Materials' }).click()
  await page.getByLabel('Keyword').fill(title.split(' ')[2])
  await page.getByRole('button', { name: 'Search' }).click()
  const item = page.getByRole('listitem').filter({ hasText: title })
  await expect(item).toBeVisible()
  await expectNoHorizontalScroll(page)
  const downloadPromise = page.waitForEvent('download')
  await item.getByRole('button', { name: `Download ${title}` }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('compat.pdf')

  await nav(page).getByRole('link', { name: 'Quizzes' }).click()
  await page.getByRole('article').filter({ hasText: quiz.title }).getByRole('button', { name: 'Start quiz' }).click()
  const timer = page.getByRole('timer')
  await expect(timer).toBeVisible()
  await expect(timer).toBeInViewport()
  await expect(timer).toContainText(/0[45]:\d{2}/)
  await expectNoHorizontalScroll(page)

  const group = page.getByRole('group', { name: new RegExp(questions[0].text) })
  await group.getByRole('radio').nth(questions[0].correctIndex).check()
  await expect(group.getByRole('radio').nth(questions[0].correctIndex)).toBeChecked()
  await expect(page.getByText('Saving answer…')).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit attempt' }).click()
  await expect(page.locator('.result-scores')).toContainText('1/5')
  await expectNoHorizontalScroll(page)
})

test('TC-Comp-01: a contributor can use the upload and question bank forms', async ({ page, request }) => {
  const contributor = await createAccount(request, 'contributor')
  await logIn(page, contributor.email, contributor.password)

  await page.goto('/#/materials/upload')
  await expect(page.getByLabel('File')).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/#/questions')
  const form = page.getByRole('form', { name: 'Add a question' })
  await form.getByLabel('Question text').fill(unique('Compat question '))
  for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) await form.getByLabel(label, { exact: true }).fill(`option ${i}`)
  await form.getByLabel('Option C is correct').check()
  await form.getByLabel('Topic').fill('Algebra')
  await form.getByRole('button', { name: 'Save question' }).click()
  await expect(form.getByRole('status')).toHaveText('Question saved to the question bank.')
  await expectNoHorizontalScroll(page)
})
