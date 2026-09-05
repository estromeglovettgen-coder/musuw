import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import { ObsidianWikiGraphRenderer } from './obsidian-graph/obsidianWikiGraphRenderer.ts'
import { createDefaultObsidianGraphSettings } from './obsidian-graph/obsidianGraphSettings.ts'

const EMPTY_CALLBACK = () => {}

/**
 * Small React lifetime adapter for the byte-for-byte Obsidian graph renderer.
 *
 * The renderer owns Pixi, the force worker, pointer gestures and the playback
 * clock. React only supplies the graph request and exposes the same commands
 * the production settings panel uses. Keeping this boundary deliberately thin
 * prevents the storefront demo from growing a second graph implementation.
 */
export const ObsidianGraphCanvas = forwardRef(function ObsidianGraphCanvas(
  {
    data,
    nodes,
    links,
    settings,
    selectedSlug = null,
    showArrows = false,
    autoPlay = false,
    className = '',
    style,
    onReady = EMPTY_CALLBACK,
    onPlaybackChange = EMPTY_CALLBACK,
    onNodeClick = EMPTY_CALLBACK,
    onNodeDoubleClick = EMPTY_CALLBACK,
    onNodeHover = EMPTY_CALLBACK,
    onStageClick = EMPTY_CALLBACK,
    onCameraScaleChange = EMPTY_CALLBACK,
  },
  ref,
) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const rendererReadyRef = useRef(false)
  const autoPlayRef = useRef(autoPlay)
  const autoPlayStartedRef = useRef(false)
  autoPlayRef.current = autoPlay
  const callbacksRef = useRef({
    onReady,
    onPlaybackChange,
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onStageClick,
    onCameraScaleChange,
  })
  callbacksRef.current = {
    onReady,
    onPlaybackChange,
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onStageClick,
    onCameraScaleChange,
  }

  const [playback, setPlayback] = useState(() => ({
    state: 'idle',
    visible: Array.isArray(data?.nodes) ? data.nodes.length : Array.isArray(nodes) ? nodes.length : 0,
    total: Array.isArray(data?.nodes) ? data.nodes.length : Array.isArray(nodes) ? nodes.length : 0,
  }))

  const graphData = useMemo(() => data ?? {
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(links) ? links : [],
  }, [data, nodes, links])
  const graphSettings = useMemo(
    () => settings ?? createDefaultObsidianGraphSettings(),
    [settings],
  )

  const requestAutoPlay = () => {
    const renderer = rendererRef.current
    if (!renderer || !rendererReadyRef.current || autoPlayStartedRef.current) return
    autoPlayStartedRef.current = true
    requestAnimationFrame(() => {
      if (rendererRef.current === renderer) renderer.startProgression?.()
    })
  }

  useImperativeHandle(ref, () => ({
    /** Start (or restart) Obsidian's node-by-node graph playback. */
    replay() {
      rendererRef.current?.startProgression?.()
    },
    play() {
      const renderer = rendererRef.current
      if (!renderer) return
      if (playback.state === 'paused') renderer.resumeProgression?.()
      else renderer.startProgression?.()
    },
    pause() {
      rendererRef.current?.pauseProgression?.()
    },
    resume() {
      rendererRef.current?.resumeProgression?.()
    },
    fit(options) {
      return rendererRef.current?.fit?.(options)
    },
    setArrowsVisible(visible) {
      rendererRef.current?.setArrowsVisible?.(visible)
    },
    setSettings(nextSettings) {
      rendererRef.current?.setObsidianSettings?.(nextSettings)
    },
    restartSimulation() {
      rendererRef.current?.restartSimulation?.()
    },
    getPlayback() {
      return playback
    },
  }), [playback])

  // Create the real Pixi/worker renderer whenever the graph data changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let disposed = false
    rendererReadyRef.current = false
    autoPlayStartedRef.current = false
    const renderer = new ObsidianWikiGraphRenderer(container)
    rendererRef.current = renderer

    const total = Array.isArray(graphData.nodes) ? graphData.nodes.length : 0
    setPlayback({ state: 'idle', visible: total, total })

    renderer.render({
      styleId: 'obsidian-exact',
      data: {
        nodes: Array.isArray(graphData.nodes) ? graphData.nodes : [],
        edges: Array.isArray(graphData.edges)
          ? graphData.edges
          : Array.isArray(graphData.links)
            ? graphData.links
            : [],
        meta: graphData.meta,
      },
      selectedSlug,
      showArrows,
      obsidianSettings: graphSettings,
      callbacks: {
        onNodeClick: (slug, modifiers) => callbacksRef.current.onNodeClick(slug, modifiers),
        onNodeDoubleClick: slug => callbacksRef.current.onNodeDoubleClick(slug),
        onNodeHover: slug => callbacksRef.current.onNodeHover(slug),
        onStageClick: () => callbacksRef.current.onStageClick(),
        onCameraScaleChange: scale => callbacksRef.current.onCameraScaleChange(scale),
        onPlaybackChange: snapshot => {
          if (disposed) return
          setPlayback(snapshot)
          callbacksRef.current.onPlaybackChange(snapshot)
        },
      },
    }).then(() => {
      if (disposed) return
      rendererReadyRef.current = true
      callbacksRef.current.onReady(renderer)
      if (autoPlayRef.current) requestAutoPlay()
    }).catch(error => {
      if (!disposed) console.error('Obsidian graph renderer failed:', error)
    })

    return () => {
      disposed = true
      rendererReadyRef.current = false
      autoPlayStartedRef.current = false
      if (rendererRef.current === renderer) rendererRef.current = null
      renderer.destroy()
    }
    // Callers can pass a stable graph object while changing controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData])

  // The parent normally toggles this when the demo card enters the viewport.
  // A transition from false to true is one Play press for this mounted graph;
  // it intentionally does not establish a timer or replay loop.
  useEffect(() => {
    if (autoPlay && rendererReadyRef.current) requestAutoPlay()
  }, [autoPlay])

  // These are settings-panel controls in the real WikiBrowser. Updating them
  // must not tear down the Pixi scene (or reset playback) just to change a
  // slider/toggle.
  useEffect(() => {
    rendererRef.current?.setObsidianSettings?.(graphSettings)
  }, [graphSettings])

  useEffect(() => {
    rendererRef.current?.setArrowsVisible?.(showArrows)
  }, [showArrows])

  useEffect(() => {
    rendererRef.current?.setSelection?.(selectedSlug, null)
  }, [selectedSlug])

  return (
    <div
      ref={containerRef}
      className={`obsidian-graph-canvas${className ? ` ${className}` : ''}`}
      data-playback-state={playback.state}
      data-playback-visible={playback.visible}
      data-playback-total={playback.total}
      style={style}
    />
  )
})

export default ObsidianGraphCanvas
