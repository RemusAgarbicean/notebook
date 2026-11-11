import { useVueFlow } from '@vue-flow/core'
import { until } from '@vueuse/core'
import { nextTick, onBeforeUnmount, ref, watch, type ShallowRef } from 'vue'
import { editRequest, gestures } from './interaction'

/**
 * Typing the text of a Node or the title of a Frame in place. The whole edit is one gesture, so one undo step.
 * `input` is the text box shown while `editing`; `root` is anything inside the Node.
 */
export function useLabelEdit(
  id: string,
  input: Readonly<ShallowRef<HTMLInputElement | HTMLTextAreaElement | null>>,
  root: Readonly<ShallowRef<HTMLElement | null>>,
) {
  const { updateNodeData, findNode } = useVueFlow()
  const editing = ref(false)

  /** `counted`: the canvas already counts this edit as a gesture in progress. */
  async function edit(counted = false) {
    if (editing.value) return
    if (!counted) gestures.value++
    editing.value = true
    // A Node just added stays hidden, and so cannot take focus, until Vue Flow has measured it.
    await until(() => !!findNode(id)?.dimensions.width).toBe(true, { timeout: 1000 })
    await nextTick()
    if (!input.value) return
    // Set once, not bound: the Node is drawn again while it grows, and that must not put the old text back.
    input.value.value = findNode(id)?.data.label ?? ''
    input.value.focus()
    input.value.select()
  }
  function stop() {
    if (editing.value) gestures.value--
    editing.value = false
  }
  function commit() {
    // Esc already ended the edit; the blur that follows must not save.
    if (!editing.value) return
    const label = input.value!.value.trim()
    stop()
    updateNodeData(id, { label })
  }
  /** Ends the edit with a key and keeps the focus on the Node, so the canvas's keys go on working. */
  function end(save: boolean) {
    if (save) commit()
    stop()
    root.value?.closest<HTMLElement>('.vue-flow__node')?.focus({ preventScroll: true })
  }
  onBeforeUnmount(stop)

  // The canvas asks for the text of what it just added to be ready for typing.
  watch(
    () => editRequest.value === id,
    (asked) => {
      if (!asked) return
      editRequest.value = null
      edit(true)
    },
    { immediate: true },
  )
  return { editing, edit, commit, end }
}
