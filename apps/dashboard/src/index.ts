import express from 'express'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '@xmpp/config'

const app = express()
const gatewayBaseUrl = `http://localhost:${config.gatewayPort}`
const moduleDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(moduleDir, '../../../')

app.use('/assets', express.static(resolve(repoRoot, 'assets')))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'xmpp-dashboard' })
})

app.get('/', (_req, res) => {
  res.type('html').send(renderDashboardHtml())
})

app.listen(config.dashboardPort, () => {
  console.log(`[xMPP] dashboard listening on :${config.dashboardPort}`)
})

function renderDashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>xMPP Operator Console</title>
    <style>
      :root {
        --cream: #f7f3e8;
        --paper: rgba(255, 251, 244, 0.78);
        --paper-strong: rgba(255, 251, 244, 0.92);
        --ink: #08141f;
        --muted: #566372;
        --line: rgba(8, 20, 31, 0.12);
        --mint: #6be7c8;
        --coral: #ff9153;
        --gold: #f2bb52;
        --navy: #0f2533;
        --danger: #c75146;
        --shadow: 0 20px 70px rgba(8, 20, 31, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        font-family: "Avenir Next", "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(107, 231, 200, 0.26), transparent 26%),
          radial-gradient(circle at top right, rgba(255, 145, 83, 0.22), transparent 24%),
          linear-gradient(180deg, #fffaf1 0%, #f7f3e8 58%, #efe7d6 100%);
      }

      .shell {
        width: min(1280px, calc(100% - 32px));
        margin: 24px auto 48px;
      }

      .panel {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
        gap: 18px;
        padding: 22px;
      }

      .brand {
        padding: 18px;
        display: grid;
        gap: 20px;
      }

      .brand-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .brand-row img {
        width: 74px;
        height: 74px;
        border-radius: 18px;
        box-shadow: 0 12px 28px rgba(8, 20, 31, 0.18);
      }

      .eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: clamp(44px, 9vw, 92px);
        line-height: 0.92;
        letter-spacing: -0.06em;
      }

      .lede {
        margin: 0;
        max-width: 780px;
        font-size: 18px;
        line-height: 1.6;
        color: var(--muted);
      }

      .hero-notes {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.7);
        font-size: 13px;
        font-weight: 700;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
      }

      .mint { background: var(--mint); }
      .coral { background: var(--coral); }
      .gold { background: var(--gold); }
      .navy { background: var(--navy); }
      .danger { background: var(--danger); }

      .hero-side {
        display: grid;
        gap: 12px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .stat {
        padding: 18px;
        border-radius: 22px;
        background: var(--paper-strong);
        border: 1px solid var(--line);
      }

      .stat-label {
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 12px;
      }

      .stat-value {
        margin-top: 8px;
        font-size: clamp(24px, 4vw, 40px);
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .stat-copy {
        margin-top: 8px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 18px;
      }

      .toolbar small {
        color: var(--muted);
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 16px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 800;
        color: #fffaf1;
        cursor: pointer;
        background: linear-gradient(135deg, var(--navy), #16374a);
        box-shadow: 0 10px 24px rgba(8, 20, 31, 0.16);
      }

      .layout {
        margin-top: 18px;
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 18px;
      }

      .stack {
        display: grid;
        gap: 18px;
      }

      .section {
        padding: 20px;
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 16px;
      }

      .section-head h2 {
        margin: 0;
        font-size: 24px;
        letter-spacing: -0.04em;
      }

      .section-head p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }

      .route-card, .budget-card, .session-card, .service-card, .event-card, .policy-card {
        border-radius: 22px;
        border: 1px solid var(--line);
        background: var(--paper-strong);
      }

      .route-card, .budget-card, .session-card, .service-card, .event-card {
        padding: 16px;
      }

      .route-card h3, .session-card h3, .service-card h3, .event-card h3, .policy-card h3 {
        margin: 0 0 8px;
        font-size: 18px;
        letter-spacing: -0.03em;
      }

      .route-tag, .service-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 800;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: #fff;
      }

      .mono {
        font-family: "JetBrains Mono", "SFMono-Regular", "Menlo", monospace;
      }

      .route-card .count {
        font-size: 36px;
        font-weight: 800;
        margin: 12px 0 6px;
      }

      .budget-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .budget-copy {
        font-size: 14px;
        line-height: 1.5;
        color: var(--muted);
      }

      .meter {
        position: relative;
        width: 100%;
        height: 12px;
        border-radius: 999px;
        background: rgba(8, 20, 31, 0.08);
        overflow: hidden;
        margin-top: 12px;
      }

      .meter > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--mint), var(--coral));
      }

      .service-list, .event-list, .session-list {
        display: grid;
        gap: 12px;
      }

      .service-copy, .event-copy, .session-copy {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.55;
      }

      .caps {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      .caps span {
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(8, 20, 31, 0.06);
        font-size: 12px;
        font-weight: 700;
      }

      .event-top, .session-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .event-meta, .session-meta {
        text-align: right;
        color: var(--muted);
        font-size: 12px;
      }

      .policy-card {
        padding: 18px;
      }

      .policy-card pre {
        margin: 12px 0 0;
        padding: 14px;
        border-radius: 18px;
        background: #fff;
        color: var(--navy);
        overflow: auto;
        font-size: 12px;
        line-height: 1.55;
      }

      a {
        color: var(--navy);
        font-weight: 700;
      }

      .empty {
        color: var(--muted);
        padding: 18px;
        border-radius: 18px;
        background: rgba(8, 20, 31, 0.04);
      }

      @media (max-width: 980px) {
        .hero, .layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100%, calc(100% - 20px));
          margin: 10px auto 28px;
        }

        .hero, .section, .toolbar {
          padding: 16px;
        }

        .summary-grid, .budget-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="panel hero">
        <div class="brand">
          <div class="brand-row">
            <img src="/assets/xmpp-mark.svg" alt="xMPP logo" />
            <div>
              <p class="eyebrow">xMPP Operator Console</p>
              <h1>x402 ↔ MPP Brain</h1>
            </div>
          </div>
          <p class="lede">xMPP intercepts paid HTTP calls, evaluates policy, picks the best Stellar settlement path, and exposes what happened back to both the agent and the operator. This view now tracks a shared treasury with separate research and market workers, alongside x402, MPP charge, MPP session open and reuse, plus explicit safety denies.</p>
          <div class="hero-notes">
            <span class="pill"><span class="dot mint"></span>Route scoring</span>
            <span class="pill"><span class="dot coral"></span>Budget feedback</span>
            <span class="pill"><span class="dot gold"></span>Session telemetry</span>
            <span class="pill"><span class="dot navy"></span>Multi-agent treasury</span>
            <span class="pill"><span class="dot danger"></span>Policy guardrails</span>
          </div>
        </div>
        <aside class="hero-side">
          <div class="summary-grid">
            <article class="stat">
              <div class="stat-label">Gateway</div>
              <div id="gateway-status" class="stat-value">Loading</div>
              <div id="gateway-copy" class="stat-copy">Checking gateway and network state.</div>
            </article>
            <article class="stat">
              <div class="stat-label">Wallet</div>
              <div id="wallet-status" class="stat-value">Loading</div>
              <div id="wallet-copy" class="stat-copy">Checking secrets and smart-account readiness.</div>
            </article>
            <article class="stat">
              <div class="stat-label">Execution</div>
              <div id="execution-mode" class="stat-value">Loading</div>
              <div id="execution-copy" class="stat-copy">x402 and MPP mode summary.</div>
            </article>
            <article class="stat">
              <div class="stat-label">Daily Budget</div>
              <div id="daily-budget" class="stat-value">Loading</div>
              <div id="daily-budget-copy" class="stat-copy">Available operator budget envelope.</div>
            </article>
          </div>
          <div class="panel toolbar">
            <small id="last-updated">Waiting for first refresh.</small>
            <button id="refresh">Refresh Console</button>
          </div>
        </aside>
      </section>

      <section class="layout">
        <div class="stack">
          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>Route Matrix</h2>
                <p>Live route counts and the exact protocol split the demo is meant to show.</p>
              </div>
            </div>
            <div id="route-matrix" class="cards"></div>
          </section>

          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>Budget And Policy</h2>
                <p>What the agent has spent, what remains, and what xMPP would block before paying.</p>
              </div>
            </div>
            <div id="budget-panel" class="budget-grid"></div>
            <div id="policy-panel" style="margin-top: 12px;"></div>
          </section>

          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>Live Decision Feed</h2>
                <p>Recent requests, selected routes, session reuse, and explorer evidence when available.</p>
              </div>
            </div>
            <div id="event-feed" class="event-list"></div>
          </section>
        </div>

        <div class="stack">
          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>Open Sessions</h2>
                <p>Current MPP channel usage with call-count taxi meters and saved spend.</p>
              </div>
            </div>
            <div id="session-panel" class="session-list"></div>
          </section>

          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>Shared Treasury Agents</h2>
                <p>Separate workers, separate ceilings, one common wallet and operator envelope.</p>
              </div>
            </div>
            <div id="agent-panel" class="service-list"></div>
          </section>

          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>Service Catalog</h2>
                <p>What xMPP knows about each paid service before it decides how to settle.</p>
              </div>
            </div>
            <div id="service-catalog" class="service-list"></div>
          </section>

          <section class="panel section">
            <div class="section-head">
              <div>
                <h2>Endpoints</h2>
                <p>Operator shortcuts for the live demo stack.</p>
              </div>
            </div>
            <div class="service-list">
              <article class="service-card">
                <h3>Gateway</h3>
                <div class="service-tag mono">${gatewayBaseUrl}</div>
              </article>
              <article class="service-card">
                <h3>Research API</h3>
                <div class="service-tag mono">${config.services.research}</div>
              </article>
              <article class="service-card">
                <h3>Market API</h3>
                <div class="service-tag mono">${config.services.market}</div>
              </article>
              <article class="service-card">
                <h3>Stream API</h3>
                <div class="service-tag mono">${config.services.stream}</div>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>

    <script type="module">
      const gatewayBaseUrl = ${JSON.stringify(gatewayBaseUrl)};
      const currency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
      const routeTone = {
        'x402': 'mint',
        'mpp-charge': 'coral',
        'mpp-session-open': 'gold',
        'mpp-session-reuse': 'navy',
      };
      const routeLabel = {
        'x402': 'x402 exact',
        'mpp-charge': 'MPP charge',
        'mpp-session-open': 'MPP session open',
        'mpp-session-reuse': 'MPP session reuse',
      };

      function formatMoney(value) {
        return currency.format(Number(value ?? 0));
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');
      }

      function routeBadge(route) {
        const tone = routeTone[route] ?? 'mint';
        return '<span class="route-tag"><span class="dot ' + tone + '"></span>' + escapeHtml(routeLabel[route] ?? route) + '</span>';
      }

      function renderRouteMatrix(state) {
        const counts = state.routeCounts ?? {};
        return [
          ['x402', 'Small exact payments'],
          ['mpp-charge', 'One-shot premium calls'],
          ['mpp-session-open', 'First channel commitment'],
          ['mpp-session-reuse', 'Amortized repeat commitments'],
        ].map(([route, copy]) => {
          const count = counts[route] ?? 0;
          return '<article class="route-card">' +
            routeBadge(route) +
            '<div class="count">' + count + '</div>' +
            '<div class="service-copy">' + escapeHtml(copy) + '</div>' +
          '</article>';
        }).join('');
      }

      function renderBudgetPanel(state, wallet) {
        const missingSecrets = wallet.missingSecrets?.length ? wallet.missingSecrets.join(', ') : 'None';
        const spentRatio = Math.min(100, ((state.spentThisSessionUsd ?? 0) / Math.max(state.dailyBudgetUsd ?? 1, 0.001)) * 100);
        const feeSponsor = wallet.feeSponsorship ?? {};
        const contractPolicyCount = state.contractAgentPolicies?.length ?? 0;
        return [
          '<article class="budget-card">' +
            '<h3>Operator Budget</h3>' +
            '<div class="service-copy">Spent ' + formatMoney(state.spentThisSessionUsd) + ' of ' + formatMoney(state.dailyBudgetUsd) + ' for this session.</div>' +
            '<div class="meter"><span style="width:' + spentRatio.toFixed(1) + '%"></span></div>' +
            '<div class="budget-copy">Remaining daily headroom: <strong>' + formatMoney(state.remainingDailyBudgetUsd) + '</strong></div>' +
          '</article>',
          '<article class="budget-card">' +
            '<h3>Session Savings</h3>' +
            '<div class="stat-value" style="font-size:34px;">' + formatMoney(state.sessionSavingsUsd) + '</div>' +
            '<div class="budget-copy">Measured against naive x402 settlement for the same requests.</div>' +
          '</article>',
          '<article class="budget-card">' +
            '<h3>Wallet Readiness</h3>' +
            '<div class="budget-copy">Connected: <strong>' + (wallet.connected ? 'yes' : 'no') + '</strong></div>' +
            '<div class="budget-copy">Strategy: <strong>' + escapeHtml(wallet.settlementStrategy ?? 'keypair-live') + '</strong></div>' +
            '<div class="budget-copy">Agent: <span class="mono">' + escapeHtml(wallet.agentPublicKey ?? 'not configured') + '</span></div>' +
            '<div class="budget-copy">Smart account: ' + escapeHtml(wallet.smartAccount?.message ?? 'Not configured') + '</div>' +
            '<div class="budget-copy">Missing secrets: <span class="mono">' + escapeHtml(missingSecrets) + '</span></div>' +
          '</article>',
          '<article class="budget-card">' +
            '<h3>Fee Sponsorship</h3>' +
            '<div class="budget-copy">Enabled: <strong>' + (feeSponsor.enabled ? 'yes' : 'no') + '</strong></div>' +
            '<div class="budget-copy">Available: <strong>' + (feeSponsor.available ? 'yes' : 'no') + '</strong></div>' +
            '<div class="budget-copy">MPP charge: <strong>' + (feeSponsor.mppChargeEnabled ? 'yes' : 'no') + '</strong></div>' +
            '<div class="budget-copy">MPP session: <strong>' + (feeSponsor.mppSessionEnabled ? 'yes' : 'no') + '</strong></div>' +
            '<div class="budget-copy">Sponsor: <span class="mono">' + escapeHtml(feeSponsor.sponsorPublicKey ?? 'not configured') + '</span></div>' +
            '<div class="budget-copy">' + escapeHtml(feeSponsor.message ?? 'Fee sponsorship is disabled.') + '</div>' +
          '</article>',
          '<article class="budget-card">' +
            '<h3>Service Spend</h3>' +
            '<div class="budget-copy">' + Object.entries(state.serviceSpendUsd ?? {}).map(([service, amount]) => escapeHtml(service) + ': <strong>' + formatMoney(amount) + '</strong>').join('<br />') + '</div>' +
            '<div class="budget-copy" style="margin-top:10px;">Contract agent policies: <strong>' + contractPolicyCount + '</strong></div>' +
          '</article>',
        ].join('');
      }

      function renderPolicyPanel(policy) {
        return '<article class="policy-card">' +
          '<h3>Denied Preview</h3>' +
          '<div class="service-copy">Sample request: <span class="mono">GET /admin/export</span></div>' +
          '<pre>' + escapeHtml(JSON.stringify(policy, null, 2)) + '</pre>' +
        '</article>';
      }

      function renderSessionPanel(state) {
        const sessions = state.openSessions ?? [];
        const contractSessions = state.contractSessions ?? [];
        if (sessions.length === 0) {
          return '<div class="empty">No live sessions recorded yet. Run the stream demo twice to show session open and reuse.</div>';
        }

        return sessions.map((session) => {
          const percent = Math.min(100, ((session.callCount ?? 0) / 8) * 100);
          const mirrored = contractSessions.some((entry) => entry.sessionId === session.sessionId);
          return '<article class="session-card">' +
            '<div class="session-top">' +
              '<div>' +
                '<h3>' + escapeHtml(session.serviceId) + '</h3>' +
                routeBadge('mpp-session-reuse') +
              '</div>' +
              '<div class="session-meta mono">' + escapeHtml(session.sessionId) + '</div>' +
            '</div>' +
            '<div class="session-copy">Commitments observed: <strong>' + (session.callCount ?? 0) + '</strong></div>' +
            '<div class="meter"><span style="width:' + percent.toFixed(1) + '%"></span></div>' +
            '<div class="session-copy">Taxi meter: cumulative commitments increase while the channel stays reusable.</div>' +
            '<div class="session-copy">Contract mirror: <strong>' + (mirrored ? 'recorded on-chain registry' : 'local only') + '</strong></div>' +
          '</article>';
        }).join('');
      }

      function renderAgentPanel(state) {
        const agents = state.agentStates ?? [];
        if (agents.length === 0) {
          return '<div class="empty">No treasury agents configured.</div>';
        }

        return agents.map((agent) => {
          const spentRatio = Math.min(100, ((agent.spentThisSessionUsd ?? 0) / Math.max(agent.dailyBudgetUsd ?? 1, 0.001)) * 100);
          return '<article class="service-card">' +
            '<h3>' + escapeHtml(agent.displayName) + '</h3>' +
            '<div class="service-tag mono">' + escapeHtml(agent.agentId) + '</div>' +
            '<div class="service-copy" style="margin-top:10px;">' + escapeHtml(agent.description) + '</div>' +
            '<div class="service-copy" style="margin-top:10px;">Spent <strong>' + formatMoney(agent.spentThisSessionUsd) + '</strong> of <strong>' + formatMoney(agent.dailyBudgetUsd) + '</strong></div>' +
            '<div class="meter"><span style="width:' + spentRatio.toFixed(1) + '%"></span></div>' +
            '<div class="service-copy" style="margin-top:10px;">Source: <strong>' + escapeHtml(agent.policySource ?? 'local') + '</strong> • Enabled: <strong>' + (agent.enabled === false ? 'no' : 'yes') + '</strong></div>' +
            '<div class="service-copy" style="margin-top:10px;">Services: <span class="mono">' + escapeHtml((agent.allowedServices ?? []).join(', ')) + '</span></div>' +
            '<div class="service-copy">Routes: <span class="mono">' + escapeHtml((agent.preferredRoutes ?? []).join(', ')) + '</span></div>' +
            '<div class="service-copy">Autopay methods: <span class="mono">' + escapeHtml((agent.autopayMethods ?? []).join(', ')) + '</span></div>' +
          '</article>';
        }).join('');
      }

      function renderServiceCatalog(data) {
        const services = data.services ?? [];
        return services.map((service) => {
          const caps = [];
          if (service.capabilities?.x402) caps.push('x402');
          if (service.capabilities?.mppCharge) caps.push('MPP charge');
          if (service.capabilities?.mppSession) caps.push('MPP session');
          return '<article class="service-card">' +
            '<h3>' + escapeHtml(service.displayName) + '</h3>' +
            '<div class="service-copy">' + escapeHtml(service.description) + '</div>' +
            '<div class="caps">' + caps.map((cap) => '<span>' + escapeHtml(cap) + '</span>').join('') + '</div>' +
            '<div class="service-copy" style="margin-top:10px;">Break-even: <strong>' + service.routingHints.breakEvenCalls + ' calls</strong><br />Preferred single call: <strong>' + escapeHtml(routeLabel[service.routingHints.preferredSingleCall] ?? service.routingHints.preferredSingleCall) + '</strong></div>' +
          '</article>';
        }).join('');
      }

      function renderEventFeed(state) {
        const events = state.recentEvents ?? [];
        if (events.length === 0) {
          return '<div class="empty">No payment events yet. Trigger xMPP through the gateway or MCP server to populate the feed.</div>';
        }

        return events.map((event) => {
          const explorer = event.explorerUrl
            ? '<a href="' + escapeHtml(event.explorerUrl) + '" target="_blank" rel="noreferrer">Open on Stellar Expert</a>'
            : '';
          const amount = event.status === 'denied' ? 'Denied before payment' : formatMoney(event.amountUsd);
          return '<article class="event-card">' +
            '<div class="event-top">' +
              '<div>' +
                '<h3>' + escapeHtml(event.serviceId) + '</h3>' +
                routeBadge(event.route) +
              '</div>' +
              '<div class="event-meta">' + new Date(event.timestamp).toLocaleTimeString() + '<br />' + escapeHtml(event.status) + '</div>' +
            '</div>' +
            '<div class="event-copy" style="margin-top:10px;">' + amount + ' • projected ' + event.projectedRequests + ' call' + (event.projectedRequests === 1 ? '' : 's') + '</div>' +
            '<div class="event-copy mono" style="margin-top:6px;">' + escapeHtml(event.method + ' ' + event.url) + '</div>' +
            '<div class="event-copy" style="margin-top:8px;">' +
              'Agent: <span class="mono">' + escapeHtml(event.agentId ?? 'shared-treasury') + '</span><br />' +
              (event.receiptId ? 'Receipt: <span class="mono">' + escapeHtml(event.receiptId) + '</span><br />' : '') +
              (event.signedReceipt ? 'Signed receipt attached<br />' : '') +
              (event.sessionId ? 'Session: <span class="mono">' + escapeHtml(event.sessionId) + '</span><br />' : '') +
              (event.settlementStrategy ? 'Execution: <span class="mono">' + escapeHtml(event.settlementStrategy) + '</span><br />' : '') +
              (event.feeSponsored != null ? 'Fee sponsored: <strong>' + (event.feeSponsored ? 'yes' : 'no') + '</strong><br />' : '') +
              (event.feeSponsorPublicKey ? 'Sponsor: <span class="mono">' + escapeHtml(event.feeSponsorPublicKey) + '</span><br />' : '') +
              (event.executionNote ? escapeHtml(event.executionNote) + '<br />' : '') +
              explorer +
            '</div>' +
          '</article>';
        }).join('');
      }

      async function refresh() {
        try {
          const [health, wallet, state, catalog, policyPreview] = await Promise.all([
            fetch(gatewayBaseUrl + '/health').then((response) => response.json()),
            fetch(gatewayBaseUrl + '/wallet').then((response) => response.json()),
            fetch(gatewayBaseUrl + '/operator/state').then((response) => response.json()),
            fetch(gatewayBaseUrl + '/catalog').then((response) => response.json()),
            fetch(
              gatewayBaseUrl +
              '/policy/preview?url=' +
              encodeURIComponent('http://localhost:4102/admin/export') +
              '&method=GET&serviceId=market-api'
            ).then((response) => response.json()),
          ]);

          document.getElementById('gateway-status').textContent = health.ok ? 'Online' : 'Offline';
          document.getElementById('gateway-copy').textContent = health.network + ' • ' + health.service;
          document.getElementById('wallet-status').textContent = wallet.connected ? 'Ready' : 'Needs secrets';
          document.getElementById('wallet-copy').textContent =
            wallet.smartAccount?.message ??
            'Key-based execution live; smart account wiring still partial.';
          document.getElementById('execution-mode').textContent = health.paymentExecutionMode;
          document.getElementById('execution-copy').textContent =
            health.paymentExecutionMode === 'testnet'
              ? 'Real Stellar testnet settlement is enabled.'
              : 'Mock execution mode is enabled for local development.';
          document.getElementById('daily-budget').textContent = formatMoney(state.dailyBudgetUsd);
          document.getElementById('daily-budget-copy').textContent =
            'Remaining ' + formatMoney(state.remainingDailyBudgetUsd) + ' after ' + formatMoney(state.spentThisSessionUsd) + ' tracked spend.';
          document.getElementById('route-matrix').innerHTML = renderRouteMatrix(state);
          document.getElementById('budget-panel').innerHTML = renderBudgetPanel(state, wallet);
          document.getElementById('policy-panel').innerHTML = renderPolicyPanel(policyPreview);
          document.getElementById('session-panel').innerHTML = renderSessionPanel(state);
          document.getElementById('agent-panel').innerHTML = renderAgentPanel(state);
          document.getElementById('service-catalog').innerHTML = renderServiceCatalog(catalog);
          document.getElementById('event-feed').innerHTML = renderEventFeed(state);
          document.getElementById('last-updated').textContent =
            'Last refresh ' + new Date().toLocaleTimeString() + ' • ' + health.paymentExecutionMode + ' mode';
        } catch (error) {
          document.getElementById('gateway-status').textContent = 'Offline';
          document.getElementById('gateway-copy').textContent = String(error);
          document.getElementById('event-feed').innerHTML =
            '<div class="empty">Refresh failed: ' + escapeHtml(String(error)) + '</div>';
        }
      }

      document.getElementById('refresh').addEventListener('click', refresh);
      refresh();
      setInterval(refresh, 8000);
    </script>
  </body>
</html>`
}
