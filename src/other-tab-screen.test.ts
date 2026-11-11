import { mount } from '@vue/test-utils'
import { afterEach, expect, test } from 'vitest'
import OtherTabScreen from './OtherTabScreen.vue'
import { tabLock } from './tab-lock'

afterEach(() => (tabLock.refused.value = false))

test('says the other tab could not save once a take-over was refused', async () => {
  const screen = mount(OtherTabScreen)
  expect(screen.find('[role="alert"]').exists()).toBe(false)

  tabLock.refused.value = true
  await screen.vm.$nextTick()

  expect(screen.get('[role="alert"]').text()).toContain('could not save')
})
