import { XmppGatewayClient } from '@vinaystwt/xmpp-core'

const client = new XmppGatewayClient({ baseUrl: 'http://localhost:4300' })

const result = await client.fetch('http://localhost:4101/research?q=stellar', {
  agentId: 'research-agent',
  serviceId: 'research-api',
  projectedRequests: 1,
})

console.log(JSON.stringify(result, null, 2))
