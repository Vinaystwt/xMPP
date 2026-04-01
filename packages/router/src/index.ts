import type { PaymentChallenge, RouteContext, RouteDecision } from '@xmpp/types'

export function createRouter() {
  return {
    async preview(input: RouteContext): Promise<RouteDecision> {
      const projected = input.projectedRequests ?? 1
      if (input.streaming || projected >= 4) {
        return {
          route: 'mpp-session-open',
          reason: 'Projected repeated usage favors channel amortization.',
          score: 0.25,
        }
      }

      if (projected === 1 && input.serviceId === 'market-api') {
        return {
          route: 'mpp-charge',
          reason: 'Single premium quote call favors MPP charge.',
          score: 0.4,
        }
      }

      return {
        route: 'x402',
        reason: 'Low-volume call favors x402 exact.',
        score: 0.1,
      }
    },
    async chooseFromChallenge(
      input: RouteContext & { challenge: PaymentChallenge; hasReusableSession?: boolean },
    ): Promise<RouteDecision> {
      if (input.challenge.kind === 'mpp-session') {
        if (input.hasReusableSession) {
          return {
            route: 'mpp-session-reuse',
            reason: 'Reusing an open MPP session is cheaper than opening a new one.',
            score: 0.05,
          }
        }

        return {
          route: 'mpp-session-open',
          reason: 'MPP session challenge detected and no reusable session exists.',
          score: 0.15,
        }
      }

      if (input.challenge.kind === 'mpp-charge') {
        return {
          route: 'mpp-charge',
          reason: 'MPP charge challenge detected for a one-time payment.',
          score: 0.2,
        }
      }

      return this.preview(input)
    },
  }
}
