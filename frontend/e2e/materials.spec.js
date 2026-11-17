import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { API, auth, createAccount, logIn, makePdf, unique, uploadMaterial } from './support/app.js'
import { db } from './support/backend.js'

const MB = 1024 * 1024

test.describe('Material sharing', () => {
  test('TC-Mat-01: a contributor uploads a 20 MB PDF, it is confirmed within 10 s and appears in search', async ({ page, request }, testInfo) => {
    const contributor = await createAccount(request, 'contributor')
    const title = unique('Thermodynamics ')
    const filePath = testInfo.outputPath('lecture-20mb.pdf')
    fs.writeFileSync(filePath, makePdf(20 * MB))

    await logIn(page, contributor.email, contributor.password)
    await page.goto('/#/materials/upload')
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Subject').fill('Physics')
    await page.getByLabel('Topic').fill('Heat')
    await page.getByLabel('File').setInputFiles(filePath)
    const startedAt = Date.now()
    await page.getByRole('button', { name: 'Upload material' }).click()
    await expect(page.getByRole('status')).toHaveText(`“${title}” was uploaded successfully.`, { timeout: 15_000 })
    expect(Date.now() - startedAt).toBeLessThan(10_000)

    const stored = await (await db()).collection('materials').findOne({ title })
    expect(stored.sizeBytes).toBe(20 * MB)

    await page.goto('/#/materials')
    await page.getByLabel('Keyword').fill(title.split(' ')[1])
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('TC-Sec-04: a 21 MB PDF and an executable renamed to .pdf are rejected with "Invalid file"', async ({ page, request }, testInfo) => {
    const contributor = await createAccount(request, 'contributor')
    const oversized = testInfo.outputPath('too-big.pdf')
    const disguised = testInfo.outputPath('setup.pdf')
    fs.writeFileSync(oversized, makePdf(21 * MB))
    fs.writeFileSync(disguised, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048)]))
    const before = await (await db()).collection('materials').countDocuments()

    await logIn(page, contributor.email, contributor.password)
    await page.goto('/#/materials/upload')
    await page.getByLabel('Title').fill('Should not be stored')
    await page.getByLabel('Subject').fill('Physics')
    await page.getByLabel('Topic').fill('Heat')

    // The page refuses a file over 20 MB before sending it.
    await page.getByLabel('File').setInputFiles(oversized)
    await page.getByRole('button', { name: 'Upload material' }).click()
    await expect(page.getByRole('alert')).toContainText('Invalid file')

    // A renamed executable passes the browser's extension check, so the server must detect it.
    await page.getByLabel('File').setInputFiles(disguised)
    await page.getByRole('button', { name: 'Upload material' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid file')

    // The server also enforces the size limit when the browser check is bypassed.
    const direct = await request.post(`${API}/materials`, {
      headers: auth(contributor.token),
      multipart: { title: 'Direct', subject: 'Physics', topic: 'Heat', file: { name: 'too-big.pdf', mimeType: 'application/pdf', buffer: makePdf(21 * MB) } },
    })
    expect(direct.status()).toBe(400)
    expect((await direct.json()).message).toBe('Invalid file')
    expect(await (await db()).collection('materials').countDocuments()).toBe(before)
  })

  test('TC-Mat-02: search lists matching materials 10 per page, newest first, and "No materials found" for no match', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const keyword = unique('kw')
    for (let i = 1; i <= 12; i += 1) {
      await uploadMaterial(request, contributor.token, { title: `${keyword} handout ${String(i).padStart(2, '0')}`, subject: i % 2 ? 'Chemistry' : 'Biology', topic: 'Cells' })
    }
    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    await page.goto('/#/materials')

    await page.getByLabel('Keyword').fill(keyword)
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('12 materials found')).toBeVisible()
    const titles = page.locator('.material-details h2')
    await expect(titles).toHaveCount(10)
    await expect(titles.first()).toHaveText(`${keyword} handout 12`)
    await expect(page.getByText('Page 1 of 2')).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Page 2 of 2')).toBeVisible()
    await expect(titles).toHaveText([`${keyword} handout 02`, `${keyword} handout 01`])

    await page.getByLabel('Subject').fill('biology')
    await page.getByLabel('Topic').fill('Cells')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('6 materials found')).toBeVisible()

    await page.getByLabel('Keyword').fill(unique('nomatch'))
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('No materials found')).toBeVisible()
  })

  test('TC-Mat-03: a download matches the stored file size and adds exactly 1 to the count each time', async ({ page, request }) => {
    const contributor = await createAccount(request, 'contributor')
    const title = unique('Download test ')
    const buffer = makePdf(300 * 1024)
    const material = await uploadMaterial(request, contributor.token, { title, fileName: 'chapter.pdf', buffer })
    const student = await createAccount(request, 'student')
    await logIn(page, student.email, student.password)
    await page.goto('/#/materials')
    await page.getByLabel('Keyword').fill(title.split(' ')[2])
    await page.getByRole('button', { name: 'Search' }).click()
    const item = page.getByRole('listitem').filter({ hasText: title })
    await expect(item).toContainText('0 downloads')

    for (const expected of [1, 2]) {
      const downloadPromise = page.waitForEvent('download')
      await item.getByRole('button', { name: `Download ${title}` }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('chapter.pdf')
      expect(fs.statSync(await download.path()).size).toBe(buffer.length)
      await expect(item).toContainText(`${expected} download${expected === 1 ? '' : 's'}`)
      const stored = await (await db()).collection('materials').findOne({ title })
      expect(stored.downloadCount).toBe(expected)
    }
    expect(material.sizeBytes).toBe(buffer.length)
  })
})
