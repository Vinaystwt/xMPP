'use client'

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import styles from './route-scorer.module.css'

type RouteName = 'x402' | 'mpp-charge' | 'mpp-session-open' | 'mpp-session-reuse'

type RouteRow = {
  name: RouteName
  color: string
  glow: string
  cost: string
  score: number
  selected?: boolean
  disabled?: boolean
  summary: string
  emphasis?: 'standard' | 'dominant'
}

type Scenario = {
  label: string
  title: string
  description: string
  baseline: string
  winningReason: string
  routes: RouteRow[]
}

const scenarios: Scenario[] = [
  {
    label: 'Research API',
    title: 'Single exact call',
    description:
      'One exact research request. Session setup is unnecessary, so x402 should win cleanly and immediately.',
    baseline: '1 request • exact payment • no session context',
    winningReason: 'Exact one-off usage matches x402 with zero session overhead.',
    routes: [
      {
        name: 'x402',
        color: 'var(--route-x402)',
        glow: 'var(--glow-x402)',
        cost: '$0.010',
        score: 94,
        selected: true,
        summary: 'Baseline route for exact single-call payments.',
      },
      {
        name: 'mpp-charge',
        color: 'var(--route-mpp-charge)',
        glow: 'var(--glow-mpp-charge)',
        cost: '$0.040',
        score: 41,
        summary: 'Premium one-shot path, but too expensive for this case.',
      },
      {
        name: 'mpp-session-open',
        color: 'var(--route-mpp-session-open)',
        glow: 'var(--glow-mpp-session-open)',
        cost: '$0.080',
        score: 22,
        summary: 'Session open overhead dominates a single call.',
      },
      {
        name: 'mpp-session-reuse',
        color: 'var(--route-mpp-session-reuse)',
        glow: 'var(--glow-mpp-session-reuse)',
        cost: 'N/A',
        score: 0,
        disabled: true,
        summary: 'No session exists yet, so reuse is unavailable.',
      },
    ],
  },
  {
    label: 'Market API',
    title: 'Premium single quote',
    description:
      'One premium quote request. The payment is still one-shot, but MPP charge beats naive x402 on cost.',
    baseline: '1 request • premium quote • no reusable session',
    winningReason: 'MPP charge is cheaper than naive x402 for this premium single shot.',
    routes: [
      {
        name: 'x402',
        color: 'var(--route-x402)',
        glow: 'var(--glow-x402)',
        cost: '$0.040',
        score: 51,
        summary: 'Works, but loses on projected cost.',
      },
      {
        name: 'mpp-charge',
        color: 'var(--route-mpp-charge)',
        glow: 'var(--glow-mpp-charge)',
        cost: '$0.030',
        score: 88,
        selected: true,
        summary: 'Best single-shot route for premium requests.',
      },
      {
        name: 'mpp-session-open',
        color: 'var(--route-mpp-session-open)',
        glow: 'var(--glow-mpp-session-open)',
        cost: '$0.070',
        score: 19,
        summary: 'Session setup overhead still hurts.',
      },
      {
        name: 'mpp-session-reuse',
        color: 'var(--route-mpp-session-reuse)',
        glow: 'var(--glow-mpp-session-reuse)',
        cost: 'N/A',
        score: 0,
        disabled: true,
        summary: 'Reuse is unavailable without an existing session.',
      },
    ],
  },
  {
    label: 'Stream API',
    title: '5 projected calls, no session',
    description:
      'Repeated streaming calls cross the break-even threshold, so opening a session becomes the rational choice.',
    baseline: '5 calls projected • repeated access • no open session',
    winningReason: 'Projected repeat usage makes session amortization favorable.',
    routes: [
      {
        name: 'x402',
        color: 'var(--route-x402)',
        glow: 'var(--glow-x402)',
        cost: '$0.050',
        score: 38,
        summary: 'Naive baseline, but repeats stay expensive.',
      },
      {
        name: 'mpp-charge',
        color: 'var(--route-mpp-charge)',
        glow: 'var(--glow-mpp-charge)',
        cost: '$0.050',
        score: 35,
        summary: 'No session advantage; still flat cost.',
      },
      {
        name: 'mpp-session-open',
        color: 'var(--route-mpp-session-open)',
        glow: 'var(--glow-mpp-session-open)',
        cost: '$0.030',
        score: 91,
        selected: true,
        summary: 'Wins because the session setup is worth it now.',
      },
      {
        name: 'mpp-session-reuse',
        color: 'var(--route-mpp-session-reuse)',
        glow: 'var(--glow-mpp-session-reuse)',
        cost: 'N/A',
        score: 0,
        disabled: true,
        summary: 'Reuse will only unlock on the next call.',
      },
    ],
  },
  {
    label: 'Stream API',
    title: '5 calls, session already open',
    description:
      'The session already exists. This is the moment that must feel obviously dominant: reuse is now the only rational route.',
    baseline: '5 more calls • reusable session present',
    winningReason: 'Session reuse removes the open cost and compounds savings immediately.',
    routes: [
      {
        name: 'x402',
        color: 'var(--route-x402)',
        glow: 'var(--glow-x402)',
        cost: '$0.050',
        score: 22,
        summary: 'Still the naive baseline, but clearly wasteful.',
      },
      {
        name: 'mpp-charge',
        color: 'var(--route-mpp-charge)',
        glow: 'var(--glow-mpp-charge)',
        cost: '$0.050',
        score: 20,
        summary: 'Single-shot charge loses once reuse exists.',
      },
      {
        name: 'mpp-session-open',
        color: 'var(--route-mpp-session-open)',
        glow: 'var(--glow-mpp-session-open)',
        cost: '$0.030',
        score: 44,
        summary: 'Still valid, but reopening loses to reuse.',
      },
      {
        name: 'mpp-session-reuse',
        color: 'var(--route-mpp-session-reuse)',
        glow: 'var(--glow-mpp-session-reuse)',
        cost: '$0.025',
        score: 96,
        selected: true,
        emphasis: 'dominant',
        summary: 'Clearly the winner once the session exists.',
      },
    ],
  },
]

const routeLabels: Record<RouteName, string> = {
  x402: 'x402',
  'mpp-charge': 'mpp-charge',
  'mpp-session-open': 'mpp-session-open',
  'mpp-session-reuse': 'mpp-session-reuse',
}

const displayRouteLabels: Record<RouteName, string> = {
  x402: 'x402',
  'mpp-charge': 'mpp-charge',
  'mpp-session-open': 'session-open',
  'mpp-session-reuse': 'session-reuse',
}

type RouteScorerProps = {
  displayMode?: boolean
}

export function RouteScorer({ displayMode = false }: RouteScorerProps) {
  const [activeScenario, setActiveScenario] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!displayMode && isPaused) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveScenario((current) => (current + 1) % scenarios.length)
    }, 4000)

    return () => window.clearInterval(timer)
  }, [displayMode, isPaused])

  const scenario = scenarios[activeScenario]
  const selectedRoute = useMemo(
    () => scenario.routes.find((route) => route.selected) ?? scenario.routes[0],
    [scenario],
  )

  return (
    <main className={`${styles.shell} ${displayMode ? styles.shellDisplay : ''}`}>
      <div className={styles.frame}>
        {!displayMode ? (
          <>
            <p className={styles.eyebrow}>Route Decision Engine</p>
            <h1 className={styles.title}>xMPP scores every request. Agents never hardcode a route again.</h1>
            <p className={styles.subtitle}>Four scenarios. Four routes. One optimal choice per request.</p>
          </>
        ) : null}

        <section
          className={`${styles.panel} ${displayMode ? styles.panelDisplay : ''}`}
          onMouseEnter={displayMode ? undefined : () => setIsPaused(true)}
          onMouseLeave={displayMode ? undefined : () => setIsPaused(false)}
        >
          <div className={`${styles.tabs} ${displayMode ? styles.tabsDisplay : ''}`}>
            {scenarios.map((item, index) => {
              const active = index === activeScenario
              const winner = item.routes.find((route) => route.selected) ?? item.routes[0]
              return (
                <button
                  key={item.label + item.title}
                  type="button"
                  className={`${styles.tab} ${active ? styles.tabActive : ''} ${displayMode ? styles.tabDisplay : ''}`}
                  onClick={() => {
                    if (displayMode) {
                      return
                    }

                    setActiveScenario(index)
                    setIsPaused(true)
                  }}
                  disabled={displayMode}
                >
                  <span className={styles.tabLabel}>{displayMode ? item.label.replace(' API', '') : item.label}</span>
                  <span className={styles.tabTitle}>
                    {displayMode ? displayRouteLabels[winner.name] : item.title}
                  </span>
                </button>
              )
            })}
          </div>

          <div className={`${styles.body} ${displayMode ? styles.bodyDisplay : ''}`}>
            {!displayMode ? <div className={styles.scenario}>
              <h2 className={styles.scenarioTitle}>
                {scenario.label}
                <br />
                {scenario.title}
              </h2>
              <p className={styles.scenarioDescription}>{scenario.description}</p>

              <div className={styles.metaGrid}>
                <article className={styles.metaCard}>
                  <span className={styles.metaLabel}>Request shape</span>
                  <span className={styles.metaValue}>{scenario.baseline}</span>
                </article>
                <article className={styles.metaCard}>
                  <span className={styles.metaLabel}>Winner</span>
                  <span className={styles.metaValue} style={{ color: selectedRoute.color }}>
                    {routeLabels[selectedRoute.name]}
                  </span>
                </article>
                <article className={styles.metaCard}>
                  <span className={styles.metaLabel}>Why it wins</span>
                  <span className={styles.metaValue}>{scenario.winningReason}</span>
                </article>
              </div>
            </div> : null}

            <div className={`${styles.scores} ${displayMode ? styles.scoresDisplay : ''}`}>
              <div className={`${styles.scoreHeader} ${displayMode ? styles.scoreHeaderDisplay : ''}`}>
                <span>Route</span>
                <span>{displayMode ? 'Route' : 'Cost'}</span>
                <span>Score</span>
              </div>

              <LayoutGroup>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={scenario.label + scenario.title}
                    className={styles.scoreList}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                  >
                    {scenario.routes.map((route, index) => (
                      <motion.article
                        key={route.name}
                        className={`${styles.row} ${route.selected ? styles.rowSelected : ''} ${
                          route.emphasis === 'dominant' ? styles.rowDominant : ''
                        }`}
                        style={
                          {
                            '--row-color': route.color,
                            '--row-glow': route.glow,
                          } as React.CSSProperties
                        }
                        initial={{ opacity: 0, x: -20 }}
                        animate={{
                          opacity: route.disabled ? 0.42 : 1,
                          x: 0,
                          scale: route.selected ? (route.emphasis === 'dominant' ? 1.024 : 1.01) : 1,
                          boxShadow: route.selected
                            ? route.emphasis === 'dominant'
                              ? `0 0 0 1px ${route.color}, 0 0 56px ${route.glow}, 0 0 120px ${route.glow}`
                              : `0 0 0 1px ${route.color}, 0 0 42px ${route.glow}, 0 0 90px ${route.glow}`
                            : '0 0 0 rgba(0,0,0,0)',
                        }}
                        transition={{
                          opacity: { duration: 0.24, delay: index * 0.05 },
                          x: { duration: 0.24, delay: index * 0.05 },
                          scale: { duration: 0.26, ease: 'easeOut' },
                          boxShadow: { duration: 0.34, ease: 'easeOut' },
                        }}
                      >
                        <div className={styles.routeCell}>
                          <div className={styles.routeTop}>
                            <span className={styles.routeDot} />
                            <strong className={styles.routeName}>{routeLabels[route.name]}</strong>
                          </div>
                          {!displayMode ? <span className={styles.routeCopy}>{route.summary}</span> : null}
                        </div>

                        <div className={styles.cost}>{displayMode ? scenario.label.replace(' API', '') : route.cost}</div>

                        <div className={styles.scoreCell}>
                          <div className={styles.scoreMeta}>
                            <span>{route.score}</span>
                            {route.selected ? <span className={styles.selectedTag}>selected</span> : <span />}
                          </div>
                          <div className={styles.scoreTrack}>
                            <motion.div
                              key={`${scenario.label}-${scenario.title}-${route.name}`}
                              className={styles.scoreFill}
                              style={{
                                boxShadow:
                                  route.emphasis === 'dominant'
                                    ? `0 0 34px ${route.glow}, 0 0 70px ${route.glow}`
                                    : undefined,
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${route.score}%` }}
                              transition={{ duration: 0.48, ease: [0.25, 1, 0.5, 1], delay: 0.08 + index * 0.05 }}
                            />
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </LayoutGroup>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
