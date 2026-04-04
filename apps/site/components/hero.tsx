import { RouteScorer } from './route-scorer'
import styles from './hero.module.css'

export function Hero() {
  return (
    <section className={styles.shell}>
      <div className={styles.grid}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Stellar Payment Infrastructure</p>
          <h1 className={styles.title}>The Payment Routing Brain for Autonomous Agents</h1>
          <p className={styles.subtitle}>
            xMPP intercepts paid HTTP calls, scores four settlement paths, and settles through the optimal route while
            operators keep policy, budget, and audit control.
          </p>
          <p className={styles.disambiguation}>xMPP = x402 + MPP routing on Stellar. Not the messaging protocol.</p>

          <div className={styles.actions}>
            <a className={styles.primaryAction} href="#route-scorer">
              See Route Logic
            </a>
            <a
              className={styles.secondaryAction}
              href="https://github.com/Vinaystwt/xMPP"
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </a>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Settlement paths</span>
              <strong className={styles.statValue}>4 live routes</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Control plane</span>
              <strong className={styles.statValue}>Soroban-backed policy</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Proof</span>
              <strong className={styles.statValue}>Stellar testnet verified</strong>
            </div>
          </div>
        </div>

        <div className={styles.visual}>
          <RouteScorer displayMode />
        </div>
      </div>
    </section>
  )
}
