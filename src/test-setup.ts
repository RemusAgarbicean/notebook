import { beforeEach } from 'vitest'

// The page's address outlives a test, and the app returns to the place it names.
beforeEach(() => {
  location.hash = ''
})
