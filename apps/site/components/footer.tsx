import { PROOF_TXS } from '../lib/proof'
import styles from './footer.module.css'

export function Footer() {
  return (
    <footer className={styles.shell}>
      <div className={styles.frame}>
        <div className={styles.columns}>
          <div className={styles.column}>
            <strong className={styles.wordmark}>xMPP</strong>
            <p className={styles.description}>Payment routing brain for autonomous agents on Stellar.</p>
          </div>

          <div className={styles.column}>
            <p className={styles.heading}>Evidence</p>
            <div className={styles.linkList}>
              {PROOF_TXS.map((tx) => (
                <a key={tx.hash} className={styles.monoLink} href={tx.explorerUrl} target="_blank" rel="noreferrer">
                  {tx.label} · {tx.display}
                </a>
              ))}
              <a
                className={styles.monoLink}
                href="https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp/detail"
                target="_blank"
                rel="noreferrer"
              >
                DoraHacks Submission →
              </a>
            </div>
          </div>

          <div className={styles.column}>
            <p className={styles.heading}>Built for</p>
            <p className={styles.description}>Stellar Agents x402 + Stripe MPP Hackathon</p>
            <a className={styles.githubLink} href="https://github.com/Vinaystwt/xMPP" target="_blank" rel="noreferrer">
              GitHub →
            </a>
          </div>
        </div>

        <div className={styles.bottomBar}>
          xMPP = x402 + MPP routing on Stellar. Not the XMPP/Jabber messaging protocol.
        </div>
      </div>
    </footer>
  )
}
