import { PROOF_TXS } from '../lib/proof'
import styles from './proof-strip.module.css'

export function ProofStrip() {
  return (
    <section className={styles.shell} aria-labelledby="proof-strip-heading">
      <div className={styles.frame}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>Live Proof</p>
          <h2 id="proof-strip-heading" className={styles.title}>
            Verified on Stellar testnet.
          </h2>
          <p className={styles.subtitle}>Real Stellar testnet settlements. Click any transaction to verify on-chain.</p>
        </div>

        <div className={styles.grid}>
          {PROOF_TXS.map((tx) => (
            <article
              key={tx.hash}
              className={styles.card}
              style={
                {
                  '--proof-color': tx.colorToken,
                } as React.CSSProperties
              }
            >
              <div className={styles.cardHeader}>
                <span className={styles.status}>
                  <span className={styles.statusDot} />
                  live
                </span>
                <span className={styles.route}>{tx.route}</span>
              </div>

              <h3 className={styles.cardTitle}>{tx.label}</h3>

              <div className={styles.hashBlock}>
                <span className={styles.hashLabel}>Tx</span>
                <span className={styles.hashValue} title={tx.hash}>
                  {tx.display}
                </span>
              </div>

              <a className={styles.link} href={tx.explorerUrl} target="_blank" rel="noreferrer">
                View on Stellar Expert
              </a>

              <div className={styles.footerRow}>
                <span className={styles.footerLabel}>Status</span>
                <strong className={styles.footerValue}>Confirmed</strong>
              </div>
            </article>
          ))}
        </div>

        <p className={styles.command}>pnpm xmpp:judge:preflight — reproducible verification path available in the repo</p>
      </div>
    </section>
  )
}
