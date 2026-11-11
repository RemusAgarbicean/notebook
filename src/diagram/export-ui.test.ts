import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../App.vue'
import { openRecord } from '../navigation'
import { closeNotebook } from '../notebook'
import { createRecord } from '../records'
import { memoryFolder } from '../storage-memory'

// Drawing the PNG needs a real browser; here it is a stand-in, and the tests are about where the PNG goes.
const png = new Blob(['png'], { type: 'image/png' })
vi.mock('html-to-image', () => ({ toBlob: async () => png }))

let app: VueWrapper
const downloads: string[] = []
const realClick = HTMLAnchorElement.prototype.click

beforeEach(async () => {
  closeNotebook()
  downloads.length = 0
  HTMLAnchorElement.prototype.click = function () {
    downloads.push(this.download)
  }
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => null, reopen: async () => null } },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
  openRecord('diagram', createRecord('diagram', 'S2P overview'))
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
})
afterEach(() => {
  app.unmount()
  HTMLAnchorElement.prototype.click = realClick
  vi.unstubAllGlobals()
})

const notice = () => app.find('[data-testid="diagram-notice"]')
const copy = () => app.get('button[aria-label="Copy PNG"]').trigger('click')

test('Copy PNG puts the picture on the clipboard and says so', async () => {
  const written: unknown[] = []
  vi.stubGlobal('ClipboardItem', class { constructor(public items: object) {} })
  vi.stubGlobal('navigator', { ...navigator, platform: navigator.platform, clipboard: { write: async (items: unknown[]) => void written.push(...items) } })

  await copy()
  await expect.poll(() => notice().exists()).toBe(true)

  expect(notice().text()).toBe('Copied to the clipboard')
  expect(await (written[0] as { items: Record<string, Promise<Blob>> }).items['image/png']).toBe(png)
  expect(downloads).toEqual([])
})

test('when the clipboard refuses, the PNG is downloaded instead and the toolbar says so', async () => {
  vi.stubGlobal('ClipboardItem', class {})
  vi.stubGlobal('navigator', { ...navigator, platform: navigator.platform, clipboard: { write: async () => Promise.reject(new Error('NotAllowedError')) } })

  await copy()
  await expect.poll(() => downloads).toEqual(['S2P overview.png'])
  expect(notice().text()).toContain('downloaded instead')
})

test('a browser without a clipboard for this page downloads too', async () => {
  vi.stubGlobal('navigator', { platform: navigator.platform })

  await copy()
  await expect.poll(() => downloads).toEqual(['S2P overview.png'])
  expect(notice().text()).toContain('downloaded instead')
})

test('Export PNG downloads the picture under the Diagram\'s title', async () => {
  await app.get('button[aria-label="Export PNG"]').trigger('click')
  await expect.poll(() => downloads).toEqual(['S2P overview.png'])
  expect(notice().exists()).toBe(false)
})
