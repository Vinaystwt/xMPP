import styles from './package-install.module.css'

const toolNames = [
  'xmpp_fetch',
  'xmpp_policy_preview',
  'xmpp_explain',
  'xmpp_estimate_workflow',
  'xmpp_session_list',
  'xmpp_receipt_verify',
  'xmpp_route_preview',
  'xmpp_treasury_snapshot',
]

export function PackageInstall() {
  return (
    <section className={styles.shell} aria-labelledby="install-heading">
      <div className={styles.frame}>
        <div className={styles.grid}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Adopt</p>
            <h2 id="install-heading" className={styles.title}>
              Install in two packages.
            </h2>

            <div className={styles.packageList}>
              <article className={styles.packageCard}>
                <h3 className={styles.packageName}>@vinaystwt/xmpp-core</h3>
                <p className={styles.packageCopy}>
                  Gateway, route scoring, policy enforcement, signed receipts, treasury tracking.
                </p>
              </article>

              <article className={styles.packageCard}>
                <h3 className={styles.packageName}>@vinaystwt/xmpp-mcp</h3>
                <p className={styles.packageCopy}>
                  MCP server for agent integration. Eight tools including xmpp_fetch, xmpp_policy_preview,
                  xmpp_explain, xmpp_estimate_workflow.
                </p>
              </article>
            </div>
          </div>

          <div className={styles.installPane}>
            <pre className={styles.codeBlock}>
              <code>npm install @vinaystwt/xmpp-core @vinaystwt/xmpp-mcp</code>
            </pre>
          </div>
        </div>

        <details className={styles.accordion} open>
          <summary className={styles.summary}>MCP Tools</summary>
          <div className={styles.toolGrid}>
            {toolNames.map((tool) => (
              <span key={tool} className={styles.toolName}>
                {tool}
              </span>
            ))}
          </div>
        </details>

        <div className={styles.ctaRow}>
          <span className={styles.ctaPrompt}>Ready to route agent payments?</span>
          <div className={styles.actions}>
            <a className={styles.primaryAction} href="/dashboard">
              Open Operator View →
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
        </div>
      </div>
    </section>
  )
}
