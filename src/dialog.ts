import type { Directive } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Gives the element the focus when it appears: a dialog's default button, so Enter and Esc reach it. */
export const vFocus: Directive<HTMLElement> = { mounted: (el) => el.focus() }

const openers = new WeakMap<HTMLElement, Element | null>()

/** The elements Tab stops at inside `el`, in order. */
export const focusable = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]

/**
 * For the root of a modal dialog: Tab stays inside it, and closing it gives the
 * focus back to whatever had it before, unless something else took it meanwhile.
 */
export const vDialog: Directive<HTMLElement> = {
  // Before the children mount: one of them takes the focus.
  created(el) {
    openers.set(el, document.activeElement)
    // A click on the dialog's text keeps the focus inside it, so Esc and Tab still reach it.
    el.tabIndex = -1
    el.style.outline = 'none'
  },
  mounted(el) {
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return
      const stops = focusable(el)
      const edge = e.shiftKey ? stops[0] : stops.at(-1)
      // The dialog itself has the focus after a click on its text.
      const at = document.activeElement
      if (!stops.length || at === edge || at === el || !el.contains(at)) {
        e.preventDefault()
        ;(e.shiftKey ? stops.at(-1) : stops[0])?.focus()
      }
    })
  },
  unmounted(el) {
    const opener = openers.get(el)
    const lost = !document.activeElement || document.activeElement === document.body
    if (lost && opener instanceof HTMLElement && opener.isConnected) opener.focus()
  },
}
