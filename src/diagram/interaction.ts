import { ref } from 'vue'

// What the canvas and its Nodes tell each other; one canvas is open at a time.

/** The Node or Frame whose text should open for typing as soon as it is drawn. */
export const editRequest = ref<string | null>(null)

/** Drags, resizes and text edits in progress: undo takes each as one step, recorded when it ends. */
export const gestures = ref(0)
