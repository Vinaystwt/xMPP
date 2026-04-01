import express from 'express'
import { config } from '@xmpp/config'

const app = express()
const gatewayBaseUrl = `http://localhost:${config.gatewayPort}`

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
    <title>xMPP Control Surface</title>
    <style>
      :root {
        --bg: #07111f;
        --panel: rgba(7, 17, 31, 0.72);
        --panel-strong: rgba(10, 26, 46, 0.92);
        --ink: #edf5ff;
        --muted: #9fb6d0;
        --line: rgba(160, 196, 255, 0.18);
        --cyan: #6de4ff;
        --mint: #7fffd4;
        --gold: #ffd166;
        --rose: #ff7b72;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(109, 228, 255, 0.22), transparent 28%),
          radial-gradient(circle at top right, rgba(127, 255, 212, 0.12), transparent 22%),
          linear-gradient(160deg, #02060d 0%, #07111f 44%, #091a30 100%);
      }

      .shell {
        width: min(1180px, calc(100% - 32px));
        margin: 24px auto 48px;
      }

      .hero, .card {
        border: 1px solid var(--line);
        background: var(--panel);
        backdrop-filter: blur(18px);
        border-radius: 24px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
      }

      .hero {
        padding: 28px;
        display: grid;
        gap: 18px;
      }

      .eyebrow {
        color: var(--cyan);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        font-size: 12px;
        margin: 0;
      }

      h1 {
        margin: 0;
        font-size: clamp(40px, 8vw, 88px);
        line-height: 0.96;
        letter-spacing: -0.05em;
      }

      .lede {
        margin: 0;
        max-width: 840px;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.6;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-top: 18px;
      }

      .card {
        padding: 18px;
      }

      .label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .value {
        font-size: 28px;
        font-weight: 700;
      }

      .value.small {
        font-size: 15px;
        line-height: 1.6;
        font-weight: 500;
        color: var(--ink);
      }

      .layout {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 16px;
        margin-top: 16px;
      }

      .panel-title {
        margin: 0 0 14px;
        font-size: 20px;
      }

      .route-list, .services, .logs {
        display: grid;
        gap: 12px;
      }

      .route-item, .service-item, .log-item {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 14px;
        background: var(--panel-strong);
      }

      .route-item strong, .service-item strong {
        display: block;
        margin-bottom: 6px;
      }

      .mono {
        font-family: "SFMono-Regular", "JetBrains Mono", "Menlo", monospace;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        margin-right: 8px;
        border: 1px solid var(--line);
      }

      .ok { color: var(--mint); }
      .warn { color: var(--gold); }
      .deny { color: var(--rose); }

      button {
        appearance: none;
        border: 0;
        border-radius: 14px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 700;
        background: linear-gradient(135deg, var(--cyan), var(--mint));
        color: #00131a;
        cursor: pointer;
      }

      @media (max-width: 880px) {
        .layout { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">xMPP Control Surface</p>
        <h1>x402 ↔ MPP Brain for Autonomous Agents</h1>
        <p class="lede">Observe route decisions, wallet readiness, and safety policy from one operator view. This dashboard is wired for a two-minute hackathon demo: x402, MPP charge, MPP session, and one explicit deny-by-policy flow.</p>
        <div class="grid">
          <article class="card">
            <div class="label">Gateway</div>
            <div id="gateway-status" class="value">Loading</div>
          </article>
          <article class="card">
            <div class="label">Execution Mode</div>
            <div id="execution-mode" class="value">Loading</div>
          </article>
          <article class="card">
            <div class="label">Wallet</div>
            <div id="wallet-status" class="value">Loading</div>
          </article>
          <article class="card">
            <div class="label">Missing Secrets</div>
            <div id="missing-secrets" class="value small">Loading</div>
          </article>
        </div>
      </section>

      <section class="layout">
        <article class="card">
          <h2 class="panel-title">Demo Routes</h2>
          <div class="route-list">
            <div class="route-item">
              <strong>x402 Research</strong>
              <span class="badge ok mono">GET /research</span>
              <div class="mono">Projected low-volume request routed to x402 exact.</div>
            </div>
            <div class="route-item">
              <strong>MPP Charge Quote</strong>
              <span class="badge ok mono">GET /quote</span>
              <div class="mono">One-shot premium request routed to MPP charge.</div>
            </div>
            <div class="route-item">
              <strong>MPP Session Stream</strong>
              <span class="badge warn mono">GET /stream/tick</span>
              <div class="mono">Repeated calls target MPP channel/session reuse. Falls back to mock challenge until channel contract is configured.</div>
            </div>
            <div class="route-item">
              <strong>Policy Deny</strong>
              <span class="badge deny mono">GET /admin/export</span>
              <div class="mono">Blocked locally before any network request or payment attempt.</div>
            </div>
          </div>
        </article>

        <article class="card">
          <h2 class="panel-title">Service Endpoints</h2>
          <div class="services">
            <div class="service-item"><strong>Gateway</strong><span class="mono">${gatewayBaseUrl}</span></div>
            <div class="service-item"><strong>Research API</strong><span class="mono">${config.services.research}</span></div>
            <div class="service-item"><strong>Market API</strong><span class="mono">${config.services.market}</span></div>
            <div class="service-item"><strong>Stream API</strong><span class="mono">${config.services.stream}</span></div>
          </div>
          <p>
            <button id="refresh">Refresh Control State</button>
          </p>
        </article>
      </section>

      <section class="card" style="margin-top: 16px;">
        <h2 class="panel-title">Live Status</h2>
        <div id="logs" class="logs"></div>
      </section>
    </main>

    <script type="module">
      const gatewayBaseUrl = ${JSON.stringify(gatewayBaseUrl)};
      const logs = document.getElementById('logs');

      function addLog(title, body, tone = 'ok') {
        const item = document.createElement('div');
        item.className = 'log-item';
        item.innerHTML = '<strong class="' + tone + '">' + title + '</strong><div class="mono">' + body + '</div>';
        return item;
      }

      async function refresh() {
        logs.innerHTML = '';
        try {
          const [health, wallet, policy] = await Promise.all([
            fetch(gatewayBaseUrl + '/health').then((r) => r.json()),
            fetch(gatewayBaseUrl + '/wallet').then((r) => r.json()),
            fetch(
              gatewayBaseUrl +
                '/policy/preview?url=' +
                encodeURIComponent('http://localhost:4102/admin/export') +
                '&method=GET'
            ).then((r) => r.json()),
          ]);

          document.getElementById('gateway-status').textContent = health.ok ? 'Online' : 'Offline';
          document.getElementById('execution-mode').textContent = health.paymentExecutionMode;
          document.getElementById('wallet-status').textContent = wallet.connected ? 'Ready' : 'Needs Secrets';
          document.getElementById('missing-secrets').textContent =
            wallet.missingSecrets.length > 0 ? wallet.missingSecrets.join(', ') : 'None';

          logs.appendChild(addLog('Gateway health', JSON.stringify(health)));
          logs.appendChild(addLog('Wallet readiness', JSON.stringify(wallet), wallet.connected ? 'ok' : 'warn'));
          logs.appendChild(addLog('Denied policy preview', JSON.stringify(policy), policy.policy.allowed ? 'ok' : 'deny'));
        } catch (error) {
          logs.appendChild(addLog('Refresh failed', String(error), 'deny'));
          document.getElementById('gateway-status').textContent = 'Offline';
        }
      }

      document.getElementById('refresh').addEventListener('click', refresh);
      refresh();
    </script>
  </body>
</html>`
}
