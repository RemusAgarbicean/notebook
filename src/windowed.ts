import { useElementSize, useEventListener } from '@vueuse/core'
import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'

/**
 * The part of a long list to put in the page: the rows in view of the scrolling `box` and a screenful
 * either side, with the heights of the rows left out above and below. Every row must be `rowHeight` px.
 * Until the box is measured it is taken to be as tall as the window.
 */
export function useWindowed<T>(box: Readonly<Ref<HTMLElement | null>>, items: MaybeRefOrGetter<T[]>, rowHeight: MaybeRefOrGetter<number>) {
  // Not useScroll: it measures the box's whole layout on every scroll event.
  const y = ref(0)
  useEventListener(box, 'scroll', () => (y.value = box.value?.scrollTop ?? 0), { passive: true })
  const { height } = useElementSize(box)
  return computed(() => {
    const all = toValue(items)
    const row = toValue(rowHeight)
    const per = Math.ceil((height.value || window.innerHeight) / row)
    const start = Math.max(0, Math.floor(y.value / row) - per)
    const end = Math.min(all.length, start + 3 * per)
    return { before: start * row, after: (all.length - end) * row, rows: all.slice(start, end) }
  })
}
