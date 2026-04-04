import styles from './problem-section.module.css'

const flowNodes = ['Agent Request', '402 Intercept', 'xMPP Gateway', 'Route Score', 'Settlement']

export function ProblemSection() {
  return (
    <section className={styles.shell} aria-labelledby="problem-heading">
      <div className={styles.frame}>
        <p className={styles.eyebrow}>The Problem</p>
        <h2 id="problem-heading" className={styles.title}>
          Agents don&apos;t choose payment methods. They hardcode them.
        </h2>

        <div className={styles.copy}>
          <p>
            Most agent payment demos show one settlement path. An agent locked to x402 pays per-call even when session
            reuse costs 25% less. An agent that opens MPP sessions for single requests wastes overhead. The choice of
            settlement primitive is a routing problem and no existing tool solves it.
          </p>

          <p>
            xMPP is the routing layer between agent and protocol. It intercepts every 402 response, scores available
            routes against cost, frequency, policy, and session state, and settles through the optimal primitive
            automatically.
          </p>

          <p>
            Operators retain full control. Budget ceilings. Policy rules. Deny-before-pay. Signed receipts.
            Contract-backed treasury on Soroban.
          </p>
        </div>

        <div className={styles.flow} aria-label="xMPP request flow">
          {flowNodes.map((node, index) => (
            <span key={node} className={styles.flowPiece}>
              <span className={`${styles.flowNode} ${node === 'xMPP Gateway' ? styles.flowGateway : ''}`}>{node}</span>
              {index < flowNodes.length - 1 ? <span className={styles.flowArrow}>→</span> : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
