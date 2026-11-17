// Helpers for driving the app: accounts, content set up through the REST API, and UI actions.
import { expect } from '@playwright/test'

export const API = 'http://localhost:5000/api'
let counter = 0

export function unique(label) {
  counter += 1
  return `${label}${Date.now().toString(36)}${counter}`
}

export function makePdf(sizeBytes = 2048) {
  const header = Buffer.from('%PDF-1.4\n% e2e test document\n')
  const trailer = Buffer.from('\n%%EOF\n')
  return Buffer.concat([header, Buffer.alloc(Math.max(0, sizeBytes - header.length - trailer.length), 0x20), trailer])
}

// Registers an account through the API and logs it in. Returns { email, password, token, user }.
export async function createAccount(request, role, name = `E2E ${role}`) {
  const email = `${unique(role)}@e2e.test`
  const password = 'abcdef12'
  const registered = await request.post(`${API}/auth/register`, { data: { name, email, password, role } })
  expect(registered.status()).toBe(201)
  return { email, password, ...(await apiLogin(request, email, password)) }
}

export async function apiLogin(request, email, password) {
  const response = await request.post(`${API}/auth/login`, { data: { email, password } })
  expect(response.status()).toBe(200)
  const { token, user } = await response.json()
  return { token, user }
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

export async function uploadMaterial(request, token, { title, subject = 'Physics', topic = 'Optics', fileName = 'notes.pdf', buffer = makePdf() }) {
  const response = await request.post(`${API}/materials`, {
    headers: auth(token),
    multipart: { title, subject, topic, file: { name: fileName, mimeType: 'application/pdf', buffer } },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).material
}

// Creates `count` questions. Question i has correct option i % 4.
export async function createQuestions(request, token, count, { topic = 'Algebra', difficulty = 'Easy', label = unique('q') } = {}) {
  const questions = []
  for (let i = 0; i < count; i += 1) {
    const response = await request.post(`${API}/questions`, {
      headers: auth(token),
      data: { text: `${label} question ${i + 1}`, options: [`${i}a`, `${i}b`, `${i}c`, `${i}d`], correctIndex: i % 4, topic, difficulty },
    })
    expect(response.status()).toBe(201)
    questions.push((await response.json()).question)
  }
  return questions
}

// There is no Quiz Builder page, so quizzes are created and published through the API (see the report).
export async function createPublishedQuiz(request, token, questions, { title = unique('Quiz '), timeLimitMinutes = 10 } = {}) {
  const created = await request.post(`${API}/quizzes`, {
    headers: auth(token),
    data: { title, timeLimitMinutes, questionIds: questions.map(question => question.id) },
  })
  expect(created.status()).toBe(201)
  const { quiz } = await created.json()
  const published = await request.post(`${API}/quizzes/${quiz.id}/publish`, { headers: auth(token) })
  expect(published.status()).toBe(200)
  return (await published.json()).quiz
}

// Takes a quiz through the API. `choose(question, index)` returns the option index to answer, or null to skip.
export async function takeQuiz(request, token, quiz, questions, choose) {
  const started = await request.post(`${API}/quizzes/${quiz.id}/attempts`, { headers: auth(token) })
  expect(started.status()).toBe(201)
  const { attempt } = await started.json()
  for (const [index, question] of questions.entries()) {
    const selectedIndex = choose(question, index)
    if (selectedIndex === null) continue
    const saved = await request.put(`${API}/quizzes/attempts/${attempt.id}/answers`, {
      headers: auth(token), data: { questionId: question.id, selectedIndex },
    })
    expect(saved.status()).toBe(200)
  }
  const submitted = await request.post(`${API}/quizzes/attempts/${attempt.id}/submit`, { headers: auth(token) })
  expect(submitted.status()).toBe(200)
  return (await submitted.json()).attempt
}

export const correctly = question => question.correctIndex
export const wrongly = question => (question.correctIndex + 1) % 4

export async function logIn(page, email, password) {
  await page.goto('/#/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/#\/$/)
}

export function nav(page) {
  return page.getByRole('navigation', { name: 'Main navigation' })
}
