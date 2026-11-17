// node --test reporter that writes one JSON document with every test's file, name, result and duration.
// Used by scripts/generate-test-reports.js for the Unit Test Report; Node's JUnit output omits the file.
import path from 'node:path'

export default async function* jsonResults(source) {
  const tests = []
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue
    const { data } = event
    // Skip the per-file wrapper entries; keep the tests themselves.
    if (data.details?.type === 'suite' || !data.file || data.name === data.file) continue
    tests.push({
      file: path.relative(process.cwd(), data.file).replace(/\\/g, '/'),
      name: data.name,
      status: event.type === 'test:fail' ? 'failed' : data.skip !== undefined ? 'skipped' : data.todo !== undefined ? 'todo' : 'passed',
      durationMs: Math.round((data.details?.duration_ms ?? 0) * 10) / 10,
      error: event.type === 'test:fail' ? String(data.details?.error?.cause?.message ?? data.details?.error?.message ?? '') : undefined,
    })
  }
  yield `${JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, tests }, null, 2)}\n`
}
