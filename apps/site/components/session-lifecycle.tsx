'use client'

import { motion, useInView } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './session-lifecycle.module.css'

type NodeTone = 'neutral' | 'open' | 'reuse' | 'close'

type LifecycleNode = {
  id: string
  label: string
  tone: NodeTone
  note?: string
}

const nodes: LifecycleNode[] = [
  { id: 'agent', label: 'Agent', tone: 'neutral' },
  { id: 'gateway', label: 'Gateway', tone: 'neutral' },
  { id: 'session-open', label: 'session-open', tone: 'open', note: 'Call 1: $0.010' },
  { id: 'session-reuse-a', label: 'session-reuse', tone: 'reuse', note: 'Call 2: $0.005' },
  { id: 'session-reuse-b', label: 'session-reuse', tone: 'reuse', note: 'Call 3: $0.005' },
  { id: 'close', label: 'Close', tone: 'close' },
]

const lineLength = 880
const activeNodeDelays = [0.12, 0.32, 0.68, 0.84, 1.0, 1.14]
const drawDuration = 1.3
const savingsTarget = 0.005

function nodeColor(tone: NodeTone) {
  switch (tone) {
    case 'open':
      return 'var(--route-mpp-session-open)'
    case 'reuse':
      return 'var(--route-mpp-session-reuse)'
    case 'close':
      return 'var(--route-deny)'
    default:
      return 'var(--text-secondary)'
  }
}

function nodeGlow(tone: NodeTone) {
  switch (tone) {
    case 'open':
      return 'var(--glow-mpp-session-open)'
    case 'reuse':
      return 'var(--glow-mpp-session-reuse)'
    case 'close':
      return 'rgba(255, 145, 83, 0.24)'
    default:
      return 'rgba(168, 183, 196, 0.16)'
  }
}

export function SessionLifecycle() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cycleRef = useRef(0)
  const counterFrameRef = useRef<number | null>(null)
  const timeoutRefs = useRef<number[]>([])
  const hasAutoPlayedRef = useRef(false)
  const inView = useInView(containerRef, { once: true, amount: 0.45 })
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(-1)
  const [savings, setSavings] = useState(0)

  const clearTimers = useCallback(() => {
    timeoutRefs.current.forEach((timeout) => window.clearTimeout(timeout))
    timeoutRefs.current = []
    if (counterFrameRef.current !== null) {
      window.cancelAnimationFrame(counterFrameRef.current)
      counterFrameRef.current = null
    }
  }, [])

  const startSavingsCount = useCallback((cycleId: number) => {
    const startedAt = performance.now()
    const duration = 760

    const tick = (now: number) => {
      if (cycleRef.current !== cycleId) {
        return
      }

      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setSavings(Number((savingsTarget * eased).toFixed(3)))

      if (progress < 1) {
        counterFrameRef.current = window.requestAnimationFrame(tick)
      } else {
        counterFrameRef.current = null
      }
    }

    counterFrameRef.current = window.requestAnimationFrame(tick)
  }, [])

  const replay = useCallback(() => {
    clearTimers()
    cycleRef.current += 1
    const cycleId = cycleRef.current

    setIsAnimating(true)
    setActiveNodeIndex(-1)
    setSavings(0)

    activeNodeDelays.forEach((delay, index) => {
      const timeout = window.setTimeout(() => {
        if (cycleRef.current !== cycleId) {
          return
        }
        setActiveNodeIndex(index)
      }, delay * 1000)

      timeoutRefs.current.push(timeout)
    })

    const completeTimeout = window.setTimeout(() => {
      if (cycleRef.current !== cycleId) {
        return
      }
      startSavingsCount(cycleId)
      setIsAnimating(false)
    }, drawDuration * 1000 + 120)

    timeoutRefs.current.push(completeTimeout)
  }, [clearTimers, startSavingsCount])

  useEffect(() => {
    if (inView && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true
      replay()
    }
  }, [inView, replay])

  useEffect(() => () => clearTimers(), [clearTimers])

  return (
    <section className={styles.shell}>
      <div
        ref={containerRef}
        className={styles.panel}
        onClick={replay}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            replay()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Replay xMPP session lifecycle animation"
      >
        <div className={styles.header}>
          <p className={styles.eyebrow}>Session Lifecycle</p>
          <h2 className={styles.title}>Session economics. Made visible.</h2>
          <p className={styles.subtitle}>
            The wire draws itself exactly once per cycle. Nodes only glow when the flow reaches them, and the savings
            counter waits until the session path is fully complete.
          </p>
        </div>

        <div className={styles.canvas}>
          <svg className={styles.diagram} viewBox="0 0 960 220" fill="none" aria-hidden="true">
            <motion.path
              d={`M40 72 H${40 + lineLength}`}
              className={styles.track}
              initial={false}
              animate={{ pathLength: isAnimating || activeNodeIndex >= 0 ? 1 : 0 }}
              transition={{ duration: drawDuration, ease: [0.2, 0.9, 0.3, 1] }}
              pathLength={1}
            />
            <motion.path
              d={`M40 72 H${40 + lineLength}`}
              className={styles.progress}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: isAnimating || activeNodeIndex >= 0 ? 1 : 0 }}
              transition={{ duration: drawDuration, ease: [0.2, 0.9, 0.3, 1] }}
            />

            {nodes.map((node, index) => {
              const x = 40 + index * 176
              const active = activeNodeIndex >= index
              const color = nodeColor(node.tone)
              const glow = nodeGlow(node.tone)

              return (
                <g key={node.id} transform={`translate(${x}, 72)`}>
                  <motion.circle
                    cx="0"
                    cy="0"
                    r="12"
                    className={styles.nodeCore}
                    initial={false}
                    animate={{
                      fill: active ? color : 'rgba(8, 20, 31, 0.98)',
                      stroke: active ? color : 'var(--border)',
                      scale: active ? 1.08 : 1,
                      filter: active ? `drop-shadow(0 0 14px ${glow}) drop-shadow(0 0 28px ${glow})` : 'none',
                    }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  />
                </g>
              )
            })}
          </svg>

          <div className={styles.nodeGrid}>
            {nodes.map((node, index) => {
              const active = activeNodeIndex >= index
              return (
                <div key={node.id} className={styles.nodeBlock}>
                  <div className={styles.nodeLabelRow}>
                    <span
                      className={`${styles.nodeDot} ${active ? styles.nodeDotActive : ''}`}
                      style={
                        {
                          '--node-color': nodeColor(node.tone),
                          '--node-glow': nodeGlow(node.tone),
                        } as React.CSSProperties
                      }
                    />
                    <span className={styles.nodeLabel}>{node.label}</span>
                  </div>
                  <span className={styles.nodeNote}>{node.note ?? '\u00A0'}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.comparison}>
          <div className={styles.compareBlock}>
            <span className={styles.compareLabel}>Naive x402:</span>
            <span className={styles.compareValue}>$0.020</span>
          </div>
          <div className={styles.compareBlock}>
            <span className={styles.compareLabel}>xMPP session:</span>
            <span className={styles.compareValue}>
              $0.015 <em className={styles.saved}>saved ${savings.toFixed(3)}</em>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
