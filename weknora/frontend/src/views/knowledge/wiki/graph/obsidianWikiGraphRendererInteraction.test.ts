import assert from 'node:assert/strict'
import test from 'node:test'

import { ObsidianWikiGraphRenderer } from './obsidianWikiGraphRenderer.ts'

function createRenderer(): any {
  return new ObsidianWikiGraphRenderer({} as HTMLElement) as any
}

function visualNode(id: string, neighbors: string[] = []): any {
  const point = { set: () => undefined }
  return {
    id,
    title: id,
    weight: 0,
    totalLinks: neighbors.length,
    hiddenNeighbors: 0,
    isEgoCenter: false,
    bloomEligible: false,
    color: 0x2ba471,
    x: 0,
    y: 0,
    neighbors: new Set(neighbors),
    rendered: true,
    fadeAlpha: 0,
    labelLift: 0,
    circle: {
      tint: 0x2ba471,
      visible: false,
      position: point,
      scale: point,
      alpha: 0,
    },
    label: {
      visible: false,
      position: point,
      scale: point,
      alpha: 0,
    },
    outline: null,
    expansionRing: null,
    bloomButton: null,
  }
}

function rendererRequest(data: any, extras: Record<string, unknown> = {}): any {
  return {
    data,
    styleId: 'obsidian-exact',
    selectedSlug: null,
    showArrows: false,
    callbacks: {
      onNodeClick: () => undefined,
      onNodeDoubleClick: () => undefined,
      onNodeHover: () => undefined,
      onStageClick: () => undefined,
    },
    ...extras,
  }
}

test('seeds newly expanded nodes beside the requested layout anchor', () => {
  const renderer = createRenderer()
  const anchor = { x: 10_000, y: 20_000 }
  const positions = new Map([['entity/anchor', anchor]])
  const request = rendererRequest({
    nodes: [
      { slug: 'entity/anchor', title: 'Anchor', page_type: 'entity', link_count: 1 },
      { slug: 'concept/new', title: 'New', page_type: 'concept', link_count: 1 },
    ],
    edges: [{ source: 'entity/anchor', target: 'concept/new' }],
  }, {
    preserveLayout: true,
    anchorSlug: 'entity/anchor',
  })

  renderer.buildData(request, positions)

  const retainedAnchor = renderer.nodeLookup.get('entity/anchor')
  const expandedNode = renderer.nodeLookup.get('concept/new')
  assert.deepEqual(
    { x: retainedAnchor.x, y: retainedAnchor.y },
    anchor,
    'existing layout coordinates must stay unchanged',
  )
  assert.ok(
    Math.hypot(expandedNode.x - anchor.x, expandedNode.y - anchor.y) <= 40.000_001,
    'a new neighbor must visibly grow from the expanded node instead of a random graph position',
  )
})

test('keeps both selected and hovered neighborhoods visible', () => {
  const renderer = createRenderer()
  renderer.selectedSlug = 'entity/selected'
  renderer.hoveredSlug = 'concept/hovered'
  renderer.width = 100
  renderer.height = 100
  renderer.panX = 50
  renderer.panY = 50

  const selectedNeighbor = visualNode('entity/selected-neighbor', ['entity/selected'])
  renderer.renderNode(selectedNeighbor)

  assert.ok(
    Math.abs(selectedNeighbor.fadeAlpha - 0.1) < Number.EPSILON,
    'hovering another node must not dim the selected node neighborhood',
  )
})

test('keeps edges from both selected and hovered neighborhoods visible', () => {
  const renderer = createRenderer()
  renderer.selectedSlug = 'entity/selected'
  renderer.hoveredSlug = 'concept/hovered'
  renderer.width = 100
  renderer.height = 100
  renderer.panX = 50
  renderer.panY = 50

  const source = visualNode('entity/selected', ['entity/selected-neighbor'])
  const target = visualNode('entity/selected-neighbor', ['entity/selected'])
  source.x = -10
  target.x = 10
  const point = { set: () => undefined }
  const line: any = { alpha: 0, tint: 0, position: point, width: 0, height: 0 }
  const arrow: any = {
    alpha: 0,
    visible: false,
    position: point,
    scale: point,
    rotation: 0,
    tint: 0,
  }
  const reverseArrow = { ...arrow, position: point, scale: point }
  const edge = {
    source,
    target,
    bidirectional: false,
    rendered: true,
    container: { visible: false, position: point, rotation: 0 },
    line,
    arrow,
    reverseArrow,
  }

  renderer.renderEdge(edge)

  assert.ok(
    Math.abs(line.alpha - 0.1) < Number.EPSILON,
    'hovering another node must not dim edges belonging to the selected neighborhood',
  )
})

test('keeps enabled arrows visible at the original minimum zoom', () => {
  const renderer = createRenderer()
  renderer.scale = 0.2
  renderer.showArrows = true
  renderer.width = 100
  renderer.height = 100
  renderer.panX = 50
  renderer.panY = 50

  const source = visualNode('entity/source', ['concept/target'])
  const target = visualNode('concept/target', ['entity/source'])
  source.x = -10
  target.x = 10
  const point = { set: () => undefined }
  const arrow: any = {
    alpha: 0,
    visible: false,
    position: point,
    scale: point,
    rotation: 0,
    tint: 0,
  }
  const edge = {
    source,
    target,
    bidirectional: true,
    rendered: true,
    container: { visible: false, position: point, rotation: 0 },
    line: { alpha: 0, tint: 0, position: point, width: 0, height: 0 },
    arrow,
    reverseArrow: { ...arrow, position: point, scale: point },
  }

  renderer.renderEdge(edge)

  assert.equal(edge.arrow.visible, true)
  assert.equal(edge.reverseArrow.visible, true)
})

test('delays hover clearing long enough to cross from a node to its bloom control', async () => {
  const renderer = createRenderer()
  const hovered = visualNode('entity/hovered')
  const hoverEvents: Array<string | null> = []
  renderer.hoveredSlug = hovered.id
  renderer.changed = () => undefined
  renderer.request = rendererRequest({ nodes: [], edges: [] }, {
    callbacks: {
      onNodeClick: () => undefined,
      onNodeDoubleClick: () => undefined,
      onNodeHover: (slug: string | null) => hoverEvents.push(slug),
      onStageClick: () => undefined,
    },
  })

  renderer.unhoverNode(hovered)
  assert.equal(renderer.hoveredSlug, hovered.id, 'pointerout must not clear hover immediately')
  assert.deepEqual(hoverEvents, [])

  renderer.hoverNode(hovered, { pointerType: 'mouse' })
  await new Promise(resolve => setTimeout(resolve, 80))

  assert.equal(renderer.hoveredSlug, hovered.id, 're-entering before the grace period must cancel clearing')
  assert.deepEqual(hoverEvents, [hovered.id])
})

test('keeps the original fit geometry while centering beside the source drawer', async () => {
  const renderer = createRenderer()
  const scaleChanges: number[] = []
  const cameraTargets: Array<{ x: number; y: number }> = []
  renderer.width = 1_000
  renderer.height = 600
  renderer.nodes = [
    { x: 0, y: 0 },
    { x: 500, y: 100 },
  ]
  renderer.request = rendererRequest({ nodes: [], edges: [] }, {
    callbacks: {
      onNodeClick: () => undefined,
      onNodeDoubleClick: () => undefined,
      onNodeHover: () => undefined,
      onStageClick: () => undefined,
      onCameraScaleChange: (scale: number) => scaleChanges.push(scale),
    },
  })
  renderer.animatePan = async (x: number, y: number) => {
    cameraTargets.push({ x, y })
  }

  await renderer.fit({ rightInset: 480 })

  const expectedScale = 1_000 / 620
  assert.ok(Math.abs(renderer.targetScale - expectedScale) < 1e-10)
  assert.ok(Math.abs(cameraTargets[0].x - (260 - 250 * expectedScale)) < 1e-10)
  assert.ok(Math.abs(cameraTargets[0].y - (300 - 50 * expectedScale)) < 1e-10)
  assert.deepEqual(scaleChanges, [expectedScale])
})

test('drops a stale selection before rendering a replacement graph', () => {
  const renderer = createRenderer()
  renderer.selectedSlug = 'entity/from-previous-graph'

  renderer.buildData(rendererRequest({
    nodes: [{ slug: 'concept/current', title: 'Current', page_type: 'concept', link_count: 0 }],
    edges: [],
  }), new Map())

  assert.equal(renderer.selectedSlug, null)
})

test('accepts the backend empty-edge representation for isolated nodes', () => {
  const renderer = createRenderer()

  renderer.buildData(rendererRequest({
    nodes: [{ slug: 'index', title: 'Index', page_type: 'index', link_count: 0 }],
    edges: null,
  }), new Map())

  assert.equal(renderer.nodes.length, 1)
  assert.deepEqual(renderer.edges, [])
})

test('applies a restored camera scale as the native eased zoom target', () => {
  const renderer = createRenderer()
  renderer.scale = 0.75
  renderer.targetScale = 0.75
  renderer.changed = () => undefined

  renderer.setObsidianSettings({ ...renderer.settings, scale: 1.5 })

  assert.equal(renderer.scale, 0.75, 'the current camera scale must keep its native easing')
  assert.equal(renderer.targetScale, 1.5, 'the restored scale must become effective without a rerender')
})

test('cancels an old camera animation before it can write into a replacement graph', async () => {
  const renderer = createRenderer()
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame
  const scheduled: { frame: FrameRequestCallback | null } = { frame: null }
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    scheduled.frame = callback
    return 1
  }) as typeof requestAnimationFrame
  renderer.app = {}
  renderer.panX = 0
  renderer.panY = 0
  renderer.changed = () => undefined

  try {
    const animation = renderer.animatePan(100, 100, 1_000)
    const panAfterFirstFrame = { x: renderer.panX, y: renderer.panY }
    await new Promise(resolve => setTimeout(resolve, 10))
    renderer.cameraAnimationGeneration += 1
    assert.ok(scheduled.frame, 'the animation must schedule a continuation frame')
    scheduled.frame(performance.now())
    await animation

    assert.deepEqual(
      { x: renderer.panX, y: renderer.panY },
      panAfterFirstFrame,
      'a cancelled animation must not mutate the next graph camera',
    )
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
  }
})

test('ignores non-primary pointer presses for node drag and canvas pan', () => {
  const renderer = createRenderer()
  renderer.changed = () => undefined
  renderer.panX = 0
  renderer.panY = 0
  renderer.app = { stage: {} }
  renderer.canvas = { style: { cursor: 'grab' } }
  const event = {
    button: 2,
    pointerId: 7,
    nativeEvent: { shiftKey: false },
    stopPropagation: () => assert.fail('an ignored press must not stop propagation'),
    getLocalPosition: () => assert.fail('an ignored press must not read coordinates'),
  }

  renderer.beginNodeDrag(visualNode('entity/current'), event)
  renderer.beginPan(event)

  assert.equal(renderer.dragState, null)
  assert.equal(renderer.panState, null)
})

test('clears selection only when a canvas press also ends on the canvas', () => {
  const renderer = createRenderer()
  const stageClicks: number[] = []
  const background = {}
  const nodeTarget = {}
  renderer.background = background
  renderer.canvas = { style: { cursor: 'grabbing' } }
  renderer.changed = () => undefined
  renderer.request = rendererRequest({ nodes: [], edges: [] }, {
    callbacks: {
      onNodeClick: () => undefined,
      onNodeDoubleClick: () => undefined,
      onNodeHover: () => undefined,
      onStageClick: () => stageClicks.push(1),
    },
  })
  const panState = () => ({
    pointerId: 7,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
    startedAt: performance.now(),
    lastAt: performance.now(),
    lastX: 0,
    lastY: 0,
  })

  renderer.panState = panState()
  renderer.endPointer({ pointerId: 7, target: nodeTarget })
  renderer.panState = panState()
  renderer.endPointer({ pointerId: 7, target: background })

  assert.equal(stageClicks.length, 1)
})

test('releases renderer-owned text textures through the public destroy lifecycle', () => {
  const destroyCalls: unknown[][] = []
  const container = {
    dataset: { graphVisual: 'obsidian-exact', graphStyle: 'obsidian-exact' },
    style: { removeProperty: () => undefined },
    replaceChildren: () => undefined,
  } as unknown as HTMLElement
  const renderer = new ObsidianWikiGraphRenderer(container) as any
  renderer.app = {
    destroy: (...args: unknown[]) => destroyCalls.push(args),
  }

  renderer.destroy()

  assert.deepEqual(destroyCalls, [[false, { children: true }]])
})
