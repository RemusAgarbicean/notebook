<script setup lang="ts">
import { BaseEdge, getBezierPath, type GraphNode, type Position } from '@vue-flow/core'
import { computed } from 'vue'
import { edgeEnd } from './canvas'

// Vue Flow's bezier Edge, except that each end picks the side of its Node that faces the other one.
// What is not declared here (the grey style among it) falls through to BaseEdge, as in Vue Flow's own Edges.
const props = defineProps<{
  sourceNode: GraphNode
  targetNode: GraphNode
  sourcePosition: Position
  targetPosition: Position
}>()

const box = (n: GraphNode) => ({ ...n.computedPosition, ...n.dimensions })
const path = computed(() => {
  const [from, to] = [box(props.sourceNode), box(props.targetNode)]
  const source = edgeEnd(from, props.sourcePosition, to)
  const target = edgeEnd(to, props.targetPosition, from)
  return getBezierPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: source.position,
    targetX: target.x,
    targetY: target.y,
    targetPosition: target.position,
  })
})
</script>

<template>
  <BaseEdge :path="path[0]" :label-x="path[1]" :label-y="path[2]" />
</template>
