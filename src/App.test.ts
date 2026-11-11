import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import App from './App.vue'

test('the sidebar shows search, Home, all 11 Record types with icons, Tags and the save status', () => {
  const sidebar = mount(App).get('[data-testid="sidebar"]')

  expect(sidebar.text()).toContain('Notebook')
  expect(sidebar.get('[data-testid="search"]').text()).toContain('⌘K')
  expect(sidebar.text()).toContain('Home')
  expect(sidebar.text()).toContain('Tags')
  expect(sidebar.get('[data-testid="save-status"]').text()).not.toBe('')

  const types = sidebar.findAll('[data-testid="record-type"]')
  expect(types.map((t) => t.text())).toEqual([
    'Systems',
    'Acronyms',
    'People',
    'Teams',
    'Processes',
    'Projects',
    'Diagrams',
    'Bookmarks',
    'Open questions',
    'Tasks',
    'Journal',
  ])
  for (const t of types) expect(t.find('svg').exists()).toBe(true)
})

test('the list and page columns sit next to the sidebar', () => {
  const app = mount(App)
  expect(app.find('[data-testid="list-column"]').exists()).toBe(true)
  expect(app.find('[data-testid="page-column"]').exists()).toBe(true)
})
