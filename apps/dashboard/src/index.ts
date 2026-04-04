import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(moduleDir, '../../../')
const assetDir = [
  resolve(repoRoot, 'assets'),
  resolve(moduleDir, '../../assets'),
  resolve(moduleDir, '../assets'),
].find((candidate) => existsSync(candidate))
const dashboardPort = Number(process.env.XMPP_DASHBOARD_PORT ?? 4310)
const gatewayPort = Number(process.env.XMPP_GATEWAY_PORT ?? 4300)
const gatewayBaseUrl =
  process.env.XMPP_DASHBOARD_GATEWAY_URL?.trim() || `http://localhost:${gatewayPort}`
const serviceUrls = {
  research: process.env.XMPP_RESEARCH_API_URL ?? 'http://localhost:4101',
  market: process.env.XMPP_MARKET_API_URL ?? 'http://localhost:4102',
  stream: process.env.XMPP_STREAM_API_URL ?? 'http://localhost:4103',
}

export function createDashboardApp() {
  const app = express()

  if (assetDir) {
    app.use('/assets', express.static(assetDir))
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'xmpp-dashboard' })
  })

  app.get('/', (_req, res) => {
    res.type('html').send(renderDashboardHtml())
  })

  return app
}

function renderDashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>xMPP Operator Console</title>
    <style>
      :root {
        --sand: #f6efe0;
        --sand-strong: rgba(246, 239, 224, 0.92);
        --mist: rgba(255, 250, 241, 0.78);
        --charcoal: #10202b;
        --slate: #4f6270;
        --line: rgba(16, 32, 43, 0.11);
        --line-strong: rgba(16, 32, 43, 0.18);
        --sea: #73e7d0;
        --ember: #ff8c59;
        --amber: #efbf5f;
        --ocean: #18394b;
        --danger: #c94b43;
        --shadow: 0 30px 80px rgba(16, 32, 43, 0.13);
        --hero-shadow: 0 40px 100px rgba(16, 32, 43, 0.18);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--charcoal);
        font-family: "Avenir Next", "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 12% 10%, rgba(115, 231, 208, 0.28), transparent 22%),
          radial-gradient(circle at 88% 12%, rgba(255, 140, 89, 0.22), transparent 24%),
          radial-gradient(circle at 50% 40%, rgba(239, 191, 95, 0.12), transparent 26%),
          linear-gradient(180deg, #fffaf0 0%, #f6efe0 48%, #eadfca 100%);
      }

      body::before,
      body::after {
        content: "";
        position: fixed;
        inset: auto;
        width: 38vw;
        height: 38vw;
        border-radius: 999px;
        filter: blur(80px);
        opacity: 0.25;
        pointer-events: none;
      }

      body::before {
        top: -10vw;
        left: -8vw;
        background: rgba(115, 231, 208, 0.48);
      }

      body::after {
        right: -10vw;
        bottom: -12vw;
        background: rgba(255, 140, 89, 0.3);
      }

      .shell {
        position: relative;
        z-index: 1;
        width: min(1360px, calc(100% - 28px));
        margin: 18px auto 60px;
      }

      .panel {
        background: var(--mist);
        border: 1px solid var(--line);
        border-radius: 30px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(20px);
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 18px 22px;
        margin-bottom: 18px;
      }

      .topbar-brand {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .topbar-brand img {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        box-shadow: 0 12px 26px rgba(16, 32, 43, 0.16);
      }

      .topbar-brand strong {
        display: block;
        font-size: 18px;
        letter-spacing: -0.03em;
      }

      .topbar-brand span,
      .topbar-links a {
        color: var(--slate);
        font-size: 13px;
      }

      .topbar-links {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .topbar-links a {
        text-decoration: none;
        font-weight: 700;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.18fr) minmax(340px, 0.82fr);
        gap: 22px;
        padding: 26px;
        background:
          linear-gradient(180deg, rgba(255, 252, 246, 0.96), rgba(246, 239, 224, 0.86)),
          radial-gradient(circle at top left, rgba(115, 231, 208, 0.18), transparent 24%);
        box-shadow: var(--hero-shadow);
      }

      .brand {
        position: relative;
        padding: 20px;
        display: grid;
        gap: 22px;
        overflow: hidden;
      }

      .brand::before {
        content: "";
        position: absolute;
        top: -120px;
        right: -80px;
        width: 260px;
        height: 260px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(115, 231, 208, 0.22), transparent 68%);
      }

      .brand-row {
        display: flex;
        align-items: center;
        gap: 18px;
        position: relative;
        z-index: 1;
      }

      .brand-row img {
        width: 86px;
        height: 86px;
        border-radius: 22px;
        box-shadow: 0 16px 36px rgba(16, 32, 43, 0.18);
      }

      .eyebrow {
        margin: 0;
        color: var(--slate);
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        font-size: clamp(52px, 8vw, 96px);
        line-height: 0.9;
        letter-spacing: -0.065em;
        max-width: 760px;
      }

      .lede {
        margin: 0;
        max-width: 780px;
        font-size: 18px;
        line-height: 1.7;
        color: var(--slate);
        position: relative;
        z-index: 1;
      }

      .hero-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .hero-card {
        min-height: 150px;
        padding: 16px;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
      }

      .hero-card h3 {
        margin: 0 0 10px;
        font-size: 16px;
        letter-spacing: -0.03em;
      }

      .hero-card p {
        margin: 0;
        color: var(--slate);
        font-size: 14px;
        line-height: 1.55;
      }

      .hero-notes {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        position: relative;
        z-index: 1;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 13px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.76);
        font-size: 13px;
        font-weight: 700;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
      }

      .mint { background: var(--sea); }
      .coral { background: var(--ember); }
      .gold { background: var(--amber); }
      .navy { background: var(--ocean); }
      .danger { background: var(--danger); }

      .hero-side {
        display: grid;
        gap: 14px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .stat {
        padding: 20px;
        border-radius: 24px;
        background: var(--sand-strong);
        border: 1px solid var(--line);
      }

      .stat-label {
        color: var(--slate);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 12px;
      }

      .stat-value {
        margin-top: 8px;
        font-size: clamp(26px, 4vw, 42px);
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .stat-copy {
        margin-top: 8px;
        color: var(--slate);
        font-size: 14px;
        line-height: 1.5;
      }

      .hero-proof {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 18px 20px;
      }

      .hero-proof small {
        color: var(--slate);
        line-height: 1.5;
      }

      .hero-proof-links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .hero-proof-links a {
        text-decoration: none;
      }

      .button-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 18px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 800;
        color: #fff9ef;
        cursor: pointer;
        background: linear-gradient(135deg, var(--ocean), #214b61);
        box-shadow: 0 14px 28px rgba(16, 32, 43, 0.16);
      }

      .ghost-button {
        border-radius: 18px;
        padding: 12px 16px;
        text-decoration: none;
        font-weight: 800;
        color: var(--charcoal);
        border: 1px solid var(--line-strong);
        background: rgba(255, 255, 255, 0.72);
      }

      .proof-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }

      .proof-card {
        padding: 20px;
        min-height: 180px;
      }

      .proof-card h2,
      .story-card h2,
      .section-head h2 {
        margin: 0;
        font-size: 24px;
        letter-spacing: -0.04em;
      }

      .proof-card p,
      .story-card p,
      .section-head p {
        color: var(--slate);
        font-size: 14px;
        line-height: 1.6;
      }

      .proof-card .mono {
        display: inline-block;
        margin-top: 10px;
        font-size: 13px;
      }

      .story-grid {
        display: grid;
        grid-template-columns: 0.92fr 1.08fr;
        gap: 18px;
        margin-top: 18px;
      }

      .story-card {
        padding: 22px;
      }

      .story-diagram {
        display: grid;
        gap: 12px;
        margin-top: 18px;
      }

      .diagram-step {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        align-items: start;
        padding: 14px 16px;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.64);
      }

      .diagram-step strong {
        font-size: 14px;
      }

      .diagram-step p {
        margin: 4px 0 0;
      }

      .step-badge {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        background: linear-gradient(135deg, var(--sea), var(--amber));
      }

      .route-rail {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-top: 18px;
      }

      .rail-card {
        padding: 16px;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
      }

      .rail-card h3 {
        margin: 0 0 8px;
        font-size: 17px;
      }

      .rail-card p {
        margin: 0;
      }

      .live-shell {
        margin-top: 18px;
        padding: 18px;
      }

      .live-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        margin-bottom: 18px;
      }

      .live-header h2 {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        font-size: clamp(34px, 5vw, 52px);
        letter-spacing: -0.05em;
      }

      .live-header p {
        margin: 8px 0 0;
        color: var(--slate);
      }

      .status-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .layout {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 18px;
      }

      .stack {
        display: grid;
        gap: 18px;
      }

      .section {
        padding: 22px;
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 16px;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }

      .route-card, .budget-card, .session-card, .service-card, .event-card, .policy-card {
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.74);
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
        font-size: 42px;
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
        background: rgba(16, 32, 43, 0.08);
        overflow: hidden;
        margin-top: 12px;
      }

      .meter > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--sea), var(--ember));
      }

      .service-list, .event-list, .session-list {
        display: grid;
        gap: 12px;
      }

      .service-copy, .event-copy, .session-copy {
        color: var(--slate);
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
        background: rgba(16, 32, 43, 0.06);
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
        color: var(--slate);
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
        color: var(--ocean);
        overflow: auto;
        font-size: 12px;
        line-height: 1.55;
      }

      a {
        color: var(--ocean);
        font-weight: 700;
      }

      .empty {
        color: var(--slate);
        padding: 18px;
        border-radius: 18px;
        background: rgba(16, 32, 43, 0.04);
      }

      .footer-note {
        margin-top: 18px;
        padding: 18px 20px;
        text-align: center;
        color: var(--slate);
        font-size: 13px;
      }

      @keyframes floatUp {
        from { transform: translateY(10px); opacity: 0.6; }
        to { transform: translateY(0); opacity: 1; }
      }

      .hero-card, .proof-card, .story-card, .section {
        animation: floatUp 700ms ease both;
      }

      @media (max-width: 980px) {
        .hero, .layout, .story-grid, .proof-strip, .route-rail {
          grid-template-columns: 1fr;
        }

        .hero-grid {
          grid-template-columns: 1fr;
        }

        .live-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100%, calc(100% - 20px));
          margin: 10px auto 32px;
        }

        .topbar,
        .hero,
        .section,
        .live-shell,
        .story-card,
        .proof-card,
        .hero-proof {
          padding: 16px;
        }

        .summary-grid, .budget-grid {
          grid-template-columns: 1fr;
        }

        .brand-row {
          align-items: flex-start;
        }

        h1 {
          font-size: clamp(42px, 14vw, 72px);
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="panel topbar">
        <div class="topbar-brand">
          <img src="/assets/xmpp-mark.svg" alt="xMPP logo" />
          <div>
            <strong>xMPP</strong>
            <span>Payment-routing brain for autonomous agents on Stellar</span>
          </div>
        </div>
        <nav class="topbar-links">
          <a href="#overview">Overview</a>
          <a href="#proof">Proof</a>
          <a href="#control-room">Control Room</a>
        </nav>
      </section>

      <section id="overview" class="panel hero">
        <div class="brand">
          <div class="brand-row">
            <img src="/assets/xmpp-mark.svg" alt="xMPP logo" />
            <div>
              <p class="eyebrow">One Site. One Brain. One Operator View.</p>
              <h1>Agents should not hardcode a payment method.</h1>
            </div>
          </div>
          <p class="lede">xMPP is the payment-routing brain and control plane for autonomous agents on Stellar. It intercepts paid HTTP requests, scores route economics and policy, then settles through the right primitive: <strong>x402</strong> for one-offs, <strong>MPP charge</strong> for premium single shots, and <strong>MPP session</strong> when repeat calls should amortize into one reusable flow.</p>
          <div class="hero-notes">
            <span class="pill"><span class="dot mint"></span>Route scoring</span>
            <span class="pill"><span class="dot coral"></span>Budget feedback</span>
            <span class="pill"><span class="dot gold"></span>Session telemetry</span>
            <span class="pill"><span class="dot navy"></span>Multi-agent treasury</span>
            <span class="pill"><span class="dot danger"></span>Policy guardrails</span>
          </div>
          <div class="hero-grid">
            <article class="hero-card">
              <h3>Route by request shape</h3>
              <p>Exact calls, premium single shots, and repeated streaming workloads do not share the same payment economics. xMPP makes that a routing problem instead of an integration accident.</p>
            </article>
            <article class="hero-card">
              <h3>Keep operators in control</h3>
              <p>Budgets, service policies, treasury slices, signed receipts, and deny-before-pay previews stay visible to the operator while the agent keeps moving.</p>
            </article>
            <article class="hero-card">
              <h3>Show the savings live</h3>
              <p>The control room below exposes session reuse, route counts, and explorer-linked evidence so judges can see why the payment choice was made.</p>
            </article>
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
          <div class="panel hero-proof">
            <div>
              <small id="last-updated">Waiting for first refresh.</small>
              <div class="hero-proof-links" style="margin-top:10px;">
                <a class="pill mono" href="https://stellar.expert/explorer/testnet/tx/2cc2f8b5388e341e66a5ee68ebd000bf4804d314b82136d091e9b33dbdb37b5b" target="_blank" rel="noreferrer">x402 proof</a>
                <a class="pill mono" href="https://stellar.expert/explorer/testnet/tx/3125c05d57563e027717cc52eff478c6612cb55fcd57a2eaee21cd5f3241b34e" target="_blank" rel="noreferrer">MPP charge proof</a>
                <a class="pill mono" href="https://www.npmjs.com/package/@vinaystwt/xmpp-core" target="_blank" rel="noreferrer">npm core</a>
                <a class="pill mono" href="https://www.npmjs.com/package/@vinaystwt/xmpp-mcp" target="_blank" rel="noreferrer">npm mcp</a>
              </div>
            </div>
            <div class="button-row">
              <a class="ghost-button" href="https://github.com/Vinaystwt/xMPP" target="_blank" rel="noreferrer">GitHub</a>
              <button id="refresh">Refresh Live Data</button>
            </div>
          </div>
        </aside>
      </section>

      <section id="proof" class="proof-strip">
        <article class="panel proof-card">
          <h2>Verified Settlement</h2>
          <p>Real Stellar testnet transactions already back the stack. The live demo is not a mock billing layer.</p>
          <a class="mono" href="https://stellar.expert/explorer/testnet/tx/2cc2f8b5388e341e66a5ee68ebd000bf4804d314b82136d091e9b33dbdb37b5b" target="_blank" rel="noreferrer">2cc2f8b5...db37b5b</a><br />
          <a class="mono" href="https://stellar.expert/explorer/testnet/tx/3125c05d57563e027717cc52eff478c6612cb55fcd57a2eaee21cd5f3241b34e" target="_blank" rel="noreferrer">3125c05d...241b34e</a>
        </article>
        <article class="panel proof-card">
          <h2>Two Public Packages</h2>
          <p>The public install surface is intentionally small: one SDK and one MCP server, both self-contained.</p>
          <div class="caps">
            <span>@vinaystwt/xmpp-core</span>
            <span>@vinaystwt/xmpp-mcp</span>
          </div>
        </article>
        <article class="panel proof-card">
          <h2>Visible Session Economics</h2>
          <p>xMPP surfaces open and reused MPP sessions, savings against naive x402, and operator-facing telemetry in one place.</p>
          <div class="caps">
            <span>mpp-session-open</span>
            <span>mpp-session-reuse</span>
            <span>sessionSavingsUsd</span>
          </div>
        </article>
      </section>

      <section class="story-grid">
        <article class="panel story-card">
          <h2>How xMPP thinks</h2>
          <p>xMPP sits between an agent and paid tools as the decision layer. It reads service capability hints, policy, projected usage, reusable session state, and route economics before it spends.</p>
          <div class="story-diagram">
            <div class="diagram-step">
              <span class="step-badge">1</span>
              <div>
                <strong>Intercept paid HTTP</strong>
                <p>An agent calls a tool normally. If the service returns <span class="mono">402 Payment Required</span>, xMPP takes over.</p>
              </div>
            </div>
            <div class="diagram-step">
              <span class="step-badge">2</span>
              <div>
                <strong>Score routes and policy</strong>
                <p>xMPP compares <span class="mono">x402</span>, <span class="mono">mpp-charge</span>, and <span class="mono">mpp-session</span> against cost, reuse potential, and operator limits.</p>
              </div>
            </div>
            <div class="diagram-step">
              <span class="step-badge">3</span>
              <div>
                <strong>Settle and prove</strong>
                <p>The chosen route settles on Stellar, receipts are signed, and the operator console updates with the exact decision and evidence.</p>
              </div>
            </div>
          </div>
        </article>

        <article class="panel story-card">
          <h2>Route economics at a glance</h2>
          <p>The differentiator is not “supports x402 and MPP.” The differentiator is that xMPP chooses between them automatically.</p>
          <div class="route-rail">
            <article class="rail-card">
              <h3>x402</h3>
              <p>Best for exact one-off requests where session setup would be wasteful.</p>
            </article>
            <article class="rail-card">
              <h3>MPP charge</h3>
              <p>Best for premium single shots where one immediate MPP payment is cheaper than naive x402.</p>
            </article>
            <article class="rail-card">
              <h3>Session open</h3>
              <p>Best for the first high-frequency call when a reusable payment channel will matter.</p>
            </article>
            <article class="rail-card">
              <h3>Session reuse</h3>
              <p>Best for repeated calls after the channel exists and savings start compounding.</p>
            </article>
          </div>
        </article>
      </section>

      <section id="control-room" class="panel live-shell">
        <div class="live-header">
          <div>
            <p class="eyebrow">Live Control Room</p>
            <h2>Operator visibility without slowing the agent down.</h2>
            <p>The same site doubles as the public product surface and the live demo console for routing, policy, treasury, and session telemetry.</p>
          </div>
          <div class="status-pills">
            <span class="pill"><span class="dot mint"></span>Live gateway state</span>
            <span class="pill"><span class="dot gold"></span>Explorer-linked events</span>
            <span class="pill"><span class="dot coral"></span>Deny-before-pay preview</span>
          </div>
        </div>

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
                  <div class="service-tag mono">${serviceUrls.research}</div>
                </article>
                <article class="service-card">
                  <h3>Market API</h3>
                  <div class="service-tag mono">${serviceUrls.market}</div>
                </article>
                <article class="service-card">
                  <h3>Stream API</h3>
                  <div class="service-tag mono">${serviceUrls.stream}</div>
                </article>
              </div>
            </section>
          </div>
        </section>
      </section>

      <div class="panel footer-note">
        xMPP combines route economics, policy controls, session reuse, and verifiable Stellar settlement in one operator-facing surface.
      </div>
    </main>

    <script type="module">
      const defaultGatewayBaseUrl = ${JSON.stringify(gatewayBaseUrl)};
      const queryGatewayBaseUrl = new URL(window.location.href).searchParams.get('gateway');
      const localDefaultGateway = /^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/i.test(defaultGatewayBaseUrl);
      const gatewayBaseUrl =
        (queryGatewayBaseUrl && queryGatewayBaseUrl.trim()) ||
        (!localDefaultGateway || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? defaultGatewayBaseUrl
          : '');
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
        const smartAccount = wallet.smartAccount ?? {};
        const operatorNotes = (smartAccount.operatorNotes ?? []).map((note) => escapeHtml(note)).join('<br />');
        const guardedFallback = smartAccount.guardedFallback ? 'yes' : 'no';
        const preflightFailures = (smartAccount.preflightFailures ?? []).join(', ') || 'None';
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
            '<div class="budget-copy">Smart account mode: <strong>' + escapeHtml(smartAccount.mode ?? 'inactive') + '</strong></div>' +
            '<div class="budget-copy">Smart account demo-ready: <strong>' + (smartAccount.demoReady ? 'yes' : 'no') + '</strong></div>' +
            '<div class="budget-copy">Guarded fallback: <strong>' + guardedFallback + '</strong></div>' +
            '<div class="budget-copy">Route coverage: <strong>' + escapeHtml(smartAccount.routeCoverage ?? 'inactive') + '</strong></div>' +
            '<div class="budget-copy">Supported routes: <span class="mono">' + escapeHtml((smartAccount.supportedRoutes ?? []).join(', ') || 'none') + '</span></div>' +
            '<div class="budget-copy">Unsupported routes: <span class="mono">' + escapeHtml((smartAccount.unsupportedRoutes ?? []).join(', ') || 'none') + '</span></div>' +
            '<div class="budget-copy">Fallback routes: <span class="mono">' + escapeHtml((smartAccount.fallbackRoutes ?? []).join(', ') || 'none') + '</span></div>' +
            '<div class="budget-copy">Coverage note: ' + escapeHtml(smartAccount.coverageMessage ?? 'Not configured') + '</div>' +
            '<div class="budget-copy">Unsupported reason: ' + escapeHtml(smartAccount.unsupportedReason ?? 'None') + '</div>' +
            '<div class="budget-copy">Configured fee ceiling: <strong>' + escapeHtml(String(smartAccount.configuredMaxTransactionFeeStroops ?? 0)) + '</strong></div>' +
            '<div class="budget-copy">Effective fee ceiling: <strong>' + escapeHtml(String(smartAccount.effectiveMaxTransactionFeeStroops ?? 0)) + '</strong></div>' +
            '<div class="budget-copy">Fee floor applied: <strong>' + (smartAccount.feeFloorApplied ? 'yes' : 'no') + '</strong></div>' +
            '<div class="budget-copy">Smart account: ' + escapeHtml(smartAccount.message ?? 'Not configured') + '</div>' +
            (operatorNotes ? '<div class="budget-copy" style="margin-top:10px;">' + operatorNotes + '</div>' : '') +
            '<div class="budget-copy">Smart-account preflight gaps: <span class="mono">' + escapeHtml(preflightFailures) + '</span></div>' +
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
          if (!gatewayBaseUrl) {
            document.getElementById('gateway-status').textContent = 'Configure';
            document.getElementById('gateway-copy').textContent =
              'Set XMPP_DASHBOARD_GATEWAY_URL or open this dashboard with ?gateway=https://your-gateway.example.com';
            document.getElementById('event-feed').innerHTML =
              '<div class="empty">Hosted dashboard is ready, but it needs a reachable xMPP gateway URL.</div>';
            document.getElementById('last-updated').textContent =
              'Waiting for a hosted gateway URL.';
            return;
          }

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

const app = createDashboardApp()

if (!process.env.VERCEL) {
  app.listen(dashboardPort, () => {
    console.log(`[xMPP] dashboard listening on :${dashboardPort}`)
  })
}

export default app
