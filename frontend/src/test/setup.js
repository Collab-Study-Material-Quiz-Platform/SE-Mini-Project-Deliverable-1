import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
