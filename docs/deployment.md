# Deployment

## Dashboard

The dashboard can still run locally through:

```bash
pnpm xmpp:dashboard
```

For a hosted dashboard, point it at a non-local gateway with either:

- `XMPP_DASHBOARD_GATEWAY_URL`
- `?gateway=https://your-gateway.example.com`

The dashboard app also includes a Vercel configuration in:

- `apps/dashboard/vercel.json`

That configuration routes all requests through the dashboard server entrypoint and bundles the shared proof assets from the repo `assets/` directory.

## Gateway

The dashboard expects a reachable xMPP gateway that exposes:

- `/health`
- `/wallet`
- `/catalog`
- `/operator/state`
- `/policy/preview`

If the dashboard is hosted separately from the rest of the stack, make sure the hosted gateway exposes those endpoints and allows the dashboard origin to call them.
