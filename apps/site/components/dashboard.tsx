'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { PROOF_TXS } from '../lib/proof'
import {
  ACTIVE_SESSIONS,
  AGENT_BUDGETS,
  INITIAL_EVENTS,
  MOCK_EVENTS,
  SERVICE_CONTROLS,
  TREASURY_STATE,
  eventColor,
  eventGlow,
  type DashboardEvent,
} from '../lib/dashboard'
import styles from './dashboard.module.css'

function RouteEventFeed() {
  const [events, setEvents] = useState<DashboardEvent[]>(INITIAL_EVENTS)
  const [nextIndex, setNextIndex] = useState(INITIAL_EVENTS.length)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNextIndex((current) => {
        const nextEvent = MOCK_EVENTS[current % MOCK_EVENTS.length]
        setEvents((existing) => [nextEvent, ...existing].slice(0, 5))
        return (current + 1) % MOCK_EVENTS.length
      })
    }, 8000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Route Events</h2>
        <span className={`${styles.panelMeta} ${styles.live}`}>
          <span className={styles.liveDot} />
          live
        </span>
      </div>

      <div className={styles.eventList}>
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.article
              key={`${event.time}-${event.route}-${event.service}`}
              className={styles.eventRow}
              style={
                {
                  '--event-color': eventColor(event.type),
                  '--event-glow': eventGlow(event.type),
                } as React.CSSProperties
              }
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0, boxShadow: `0 0 0 1px rgba(255,255,255,0.01), 0 0 24px var(--event-glow)` }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <span className={styles.eventTime}>{event.time}</span>
              <strong className={styles.eventRoute}>{event.route}</strong>
              <span className={styles.eventService}>{event.service}</span>
              <span className={styles.eventAmount}>{event.amount}</span>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

function SessionStatePanel() {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Session State</h2>
        <span className={styles.panelMeta}>active sessions</span>
      </div>

      <div className={styles.sessionList}>
        {ACTIVE_SESSIONS.map((session) => (
          <article key={session.service} className={styles.sessionRow}>
            <div className={styles.sessionTop}>
              <span className={styles.sessionService}>{session.service}</span>
              <span
                className={`${styles.sessionStatus} ${
                  session.status === 'OPEN' ? styles.statusOpen : styles.statusClosed
                }`}
              >
                {session.status}
              </span>
            </div>
            <span className={styles.sessionMeta}>
              calls: {session.calls}
              {session.saved ? ` • ${session.saved}` : ''}
            </span>
          </article>
        ))}
      </div>

      <div className={styles.lifecycleMini}>
        <div className={styles.miniTrack}>
          <div className={styles.miniProgress} />
        </div>
        <div className={styles.miniNodes}>
          <div className={styles.miniNode}>
            <span className={`${styles.miniDot} ${styles.miniDotOpen}`} />
            <span className={styles.miniLabel}>session-open</span>
            <span className={styles.miniNote}>Call 1 • $0.010</span>
          </div>
          <div className={styles.miniNode}>
            <span className={`${styles.miniDot} ${styles.miniDotReuse}`} />
            <span className={styles.miniLabel}>session-reuse</span>
            <span className={styles.miniNote}>Call 2 • $0.005</span>
          </div>
          <div className={styles.miniNode}>
            <span className={`${styles.miniDot} ${styles.miniDotReuse}`} />
            <span className={styles.miniLabel}>session-reuse</span>
            <span className={styles.miniNote}>Call 3 • $0.005</span>
          </div>
          <div className={styles.miniNode}>
            <span className={`${styles.miniDot} ${styles.miniDotClose}`} />
            <span className={styles.miniLabel}>close</span>
            <span className={styles.miniNote}>settled</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function TreasuryBudgetPanel() {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Treasury &amp; Budget</h2>
        <span className={styles.panelMeta}>contract-backed</span>
      </div>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total spend</span>
          <strong className={styles.summaryValue}>{TREASURY_STATE.totalSpend}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Remaining budget</span>
          <strong className={styles.summaryValue}>{TREASURY_STATE.remainingBudget}</strong>
        </article>
      </div>

      <div className={styles.budgetList}>
        {AGENT_BUDGETS.map((budget) => {
          const percent = Math.min((budget.used / budget.total) * 100, 100)
          return (
            <article key={budget.agent} className={styles.summaryCard}>
              <div className={styles.budgetRow}>
                <span className={styles.budgetLabel}>{budget.agent}</span>
                <span className={styles.budgetValue}>
                  ${budget.used.toFixed(3)} / ${budget.total.toFixed(3)}
                </span>
              </div>
              <div className={styles.budgetBar}>
                <div className={styles.budgetFill} style={{ width: `${percent}%` }} />
              </div>
            </article>
          )
        })}
      </div>

      <div className={styles.serviceList}>
        {SERVICE_CONTROLS.map((control) => (
          <div key={control.service} className={styles.serviceRow}>
            <span className={styles.serviceLabel}>{control.service}</span>
            <span className={styles.serviceValue}>{control.enabled ? 'enabled' : 'disabled'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ReceiptsProofPanel() {
  const latestReceipt = useMemo(() => PROOF_TXS[0], [])

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Receipts &amp; Proof</h2>
        <span className={styles.panelMeta}>signed evidence</span>
      </div>

      <div className={styles.receiptList}>
        <article className={styles.receiptRow}>
          <div className={styles.receiptTop}>
            <span className={styles.receiptLabel}>Latest receipt</span>
            <button
              type="button"
              className={styles.receiptButton}
              onClick={() => window.open(latestReceipt.explorerUrl, '_blank', 'noopener,noreferrer')}
            >
              verify
            </button>
          </div>
          <span className={styles.receiptHash}>{latestReceipt.display}</span>
        </article>

        {PROOF_TXS.map((tx) => (
          <article key={tx.hash} className={styles.receiptRow}>
            <div className={styles.receiptTop}>
              <span className={styles.receiptMeta}>{tx.label}</span>
              <a className={styles.explorerLink} href={tx.explorerUrl} target="_blank" rel="noreferrer">
                explorer
              </a>
            </div>
            <span className={styles.receiptHash}>{tx.display}</span>
          </article>
        ))}
      </div>

      <div className={styles.receiptList}>
        <div className={styles.policyRow}>
          <span className={styles.policyLabel}>Soroban contract</span>
          <span className={styles.policyValue}>verified</span>
        </div>
        <div className={styles.policyRow}>
          <span className={styles.policyLabel}>Session registry</span>
          <span className={styles.policyValue}>verified</span>
        </div>
      </div>
    </section>
  )
}

export function Dashboard() {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <strong className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            xMPP
          </strong>
          <span className={styles.title}>Operator Control Room</span>
          <span className={styles.badge}>testnet</span>
          <span className={styles.wallet}>wallet: {TREASURY_STATE.wallet}</span>
          <span className={styles.treasury}>
            treasury: <strong>{TREASURY_STATE.treasury}</strong>
          </span>
        </header>

        <section className={styles.grid}>
          <RouteEventFeed />
          <SessionStatePanel />
          <TreasuryBudgetPanel />
          <ReceiptsProofPanel />
        </section>
      </div>
    </main>
  )
}
