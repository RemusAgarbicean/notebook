<script setup lang="ts">
import { BaseEdge, getBezierPath, getSmoothStepPath, getStraightPath, type GraphNode, type Position } from '@vue-flow/core'
import { computed } from 'vue'
import { ARROW_LENGTH, arrowHead, EDGE_GREY, edgeEnd, edgeOptions, INTO_SIDE } from './canvas'

// Vue Flow's Edge, except that each end picks the side of its Node that faces the other one,
// and that the path, the dashes and the arrowheads follow the Edge's options.
// What is not declared here (the grey style among it) goes on to BaseEdge, as in Vue Flow's own Edges.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  sourceNode: GraphNode
  targetNode: GraphNode
  sourcePosition: Position
  targetPosition: Position
  data?: unknown
}>()

const options = computed(() => edgeOptions(props.data))
const box = (n: GraphNode) => ({ ...n.computedPosition, ...n.dimensions })

const drawn = computed(() => {
  const [from, to] = [box(props.sourceNode), box(props.targetNode)]
  const source = edgeEnd(from, props.sourcePosition, to)
  const target = edgeEnd(to, props.targetPosition, from)
  const { arrow, path } = options.value
  // The direction in which the line arrives at each end.
  const along = Math.atan2(target.y - source.y, target.x - source.x)
  const [intoTarget, intoSource] = path === 'straight' ? [along, along + Math.PI] : [INTO_SIDE[target.position], INTO_SIDE[source.position]]
  const heads = [...(arrow === 'none' ? [] : [{ ...target, angle: intoTarget }]), ...(arrow === 'both' ? [{ ...source, angle: intoSource }] : [])]
  // The line stops at the back of an arrowhead, so its square end does not show at the tip.
  const back = (end: { x: number; y: number }, angle: number, has: boolean) =>
    has ? { x: end.x - ARROW_LENGTH * Math.cos(angle), y: end.y - ARROW_LENGTH * Math.sin(angle) } : end
  const [s, t] = [back(source, intoSource, arrow === 'both'), back(target, intoTarget, arrow !== 'none')]
  const ends = { sourceX: s.x, sourceY: s.y, sourcePosition: source.position, targetX: t.x, targetY: t.y, targetPosition: target.position }
  const [d, labelX, labelY] = path === 'straight' ? getStraightPath(ends) : path === 'step' ? getSmoothStepPath(ends) : getBezierPath(ends)
  return { d, labelX, labelY, heads: heads.map((h) => arrowHead(h.x, h.y, h.angle)) }
})
</script>

<template>
  <BaseEdge
    v-bind="$attrs"
    :path="drawn.d"
    :label-x="drawn.labelX"
    :label-y="drawn.labelY"
    :style="options.line === 'dashed' ? { strokeDasharray: '6 4' } : undefined"
  />
  <!-- Arrowheads are shapes of their own, colored inline: SVG markers and CSS colors do not survive the PNG export. -->
  <polygon v-for="points in drawn.heads" :key="points" class="diagram-arrow" :points="points" :style="{ fill: EDGE_GREY, stroke: 'none' }" />
</template>
