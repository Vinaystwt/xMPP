import { createGatewayApp } from './app.js'
import { config } from '@xmpp/config'

const app = createGatewayApp()
const port = config.gatewayPort

app.listen(port, () => {
  console.log(`[xMPP] gateway listening on :${port}`)
})
