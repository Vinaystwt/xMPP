import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(moduleDir, '../../../')

loadEnv({ path: resolve(repoRoot, '.env') })
loadEnv({ path: resolve(repoRoot, '.env.local'), override: true })
loadEnv()

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  XMPP_NETWORK: z.string().default('stellar:testnet'),
  XMPP_PAYMENT_EXECUTION_MODE: z.enum(['mock', 'testnet']).default('mock'),
  XMPP_RPC_URL: z.string().default('https://soroban-testnet.stellar.org'),
  XMPP_NETWORK_PASSPHRASE: z.string().default('Test SDF Network ; September 2015'),
  XMPP_GATEWAY_PORT: z.coerce.number().default(4300),
  XMPP_DASHBOARD_PORT: z.coerce.number().default(4310),
  XMPP_DAILY_BUDGET_USD: z.coerce.number().default(0.5),
  XMPP_AGENT_SECRET_KEY: z.string().optional(),
  XMPP_SMART_ACCOUNT_CONTRACT_ID: z.string().optional(),
  XMPP_SMART_ACCOUNT_WASM_HASH: z
    .string()
    .default('3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c'),
  XMPP_WEBAUTHN_VERIFIER_ADDRESS: z
    .string()
    .default('CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH'),
  XMPP_ED25519_VERIFIER_ADDRESS: z
    .string()
    .default('CAIKK32K3BZJYTWVTXHZFPIEEDBR6YCVTGPABH4UQUQ4XFA3OLYXG27G'),
  XMPP_SPENDING_LIMIT_POLICY_ADDRESS: z
    .string()
    .default('CBYLPYZGLQ6JVY2IQ5P23QLQPR3KAMMKMZLNWG6RUUKJDNYGPLVHK7U4'),
  XMPP_THRESHOLD_POLICY_ADDRESS: z
    .string()
    .default('CDDQLFG7CV74QHWPSP6NZIPNBR2PPCMTUVYCJF4P3ONDYHODRFGR7LWC'),
  X402_FACILITATOR_URL: z.string().default('http://localhost:4022'),
  X402_FACILITATOR_API_KEY: z.string().optional(),
  X402_MAX_TRANSACTION_FEE_STROOPS: z.coerce.number().default(2000000),
  X402_RECIPIENT_ADDRESS: z.string().optional(),
  FACILITATOR_STELLAR_PRIVATE_KEY: z.string().optional(),
  MPP_SECRET_KEY: z.string().optional(),
  MPP_RECIPIENT_ADDRESS: z.string().optional(),
  MPP_CHANNEL_CONTRACT_ID: z.string().optional(),
  XMPP_ENABLE_MPP_FEE_SPONSORSHIP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  XMPP_ENABLE_MPP_CHARGE_FEE_SPONSORSHIP: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  XMPP_ENABLE_MPP_SESSION_FEE_SPONSORSHIP: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  XMPP_MPP_FEE_SPONSOR_SECRET_KEY: z.string().optional(),
  XMPP_MPP_FEE_BUMP_SECRET_KEY: z.string().optional(),
  XMPP_RESEARCH_API_URL: z.string().default('http://localhost:4101'),
  XMPP_MARKET_API_URL: z.string().default('http://localhost:4102'),
  XMPP_STREAM_API_URL: z.string().default('http://localhost:4103'),
  XMPP_POLICY_CONTRACT_ID: z.string().optional(),
  XMPP_SESSION_REGISTRY_CONTRACT_ID: z.string().optional(),
})

const env = envSchema.parse(process.env)
const mppFeeSponsorshipEnabled = env.XMPP_ENABLE_MPP_FEE_SPONSORSHIP
const mppChargeFeeSponsorshipEnabled =
  env.XMPP_ENABLE_MPP_CHARGE_FEE_SPONSORSHIP ?? mppFeeSponsorshipEnabled
const mppSessionFeeSponsorshipEnabled =
  env.XMPP_ENABLE_MPP_SESSION_FEE_SPONSORSHIP ?? mppFeeSponsorshipEnabled

export const config = {
  nodeEnv: env.NODE_ENV,
  network: env.XMPP_NETWORK,
  paymentExecutionMode: env.XMPP_PAYMENT_EXECUTION_MODE,
  rpcUrl: env.XMPP_RPC_URL,
  networkPassphrase: env.XMPP_NETWORK_PASSPHRASE,
  gatewayPort: env.XMPP_GATEWAY_PORT,
  dashboardPort: env.XMPP_DASHBOARD_PORT,
  dailyBudgetUsd: env.XMPP_DAILY_BUDGET_USD,
  facilitatorUrl: env.X402_FACILITATOR_URL,
  wallet: {
    agentSecretKey: env.XMPP_AGENT_SECRET_KEY,
    smartAccountContractId: env.XMPP_SMART_ACCOUNT_CONTRACT_ID,
    smartAccountWasmHash: env.XMPP_SMART_ACCOUNT_WASM_HASH,
    webauthnVerifierAddress: env.XMPP_WEBAUTHN_VERIFIER_ADDRESS,
    ed25519VerifierAddress: env.XMPP_ED25519_VERIFIER_ADDRESS,
    spendingLimitPolicyAddress: env.XMPP_SPENDING_LIMIT_POLICY_ADDRESS,
    thresholdPolicyAddress: env.XMPP_THRESHOLD_POLICY_ADDRESS,
  },
  x402: {
    facilitatorUrl: env.X402_FACILITATOR_URL,
    facilitatorApiKey: env.X402_FACILITATOR_API_KEY,
    maxTransactionFeeStroops: env.X402_MAX_TRANSACTION_FEE_STROOPS,
    facilitatorPrivateKey: env.FACILITATOR_STELLAR_PRIVATE_KEY,
    recipientAddress: env.X402_RECIPIENT_ADDRESS,
  },
  mpp: {
    secretKey: env.MPP_SECRET_KEY,
    recipientAddress: env.MPP_RECIPIENT_ADDRESS,
    channelContractId: env.MPP_CHANNEL_CONTRACT_ID,
    feeSponsorshipEnabled: mppFeeSponsorshipEnabled,
    feeSponsorship: {
      chargeEnabled: mppChargeFeeSponsorshipEnabled,
      sessionEnabled: mppSessionFeeSponsorshipEnabled,
    },
    feeSponsorSecretKey: env.XMPP_MPP_FEE_SPONSOR_SECRET_KEY,
    feeBumpSecretKey: env.XMPP_MPP_FEE_BUMP_SECRET_KEY,
  },
  services: {
    research: env.XMPP_RESEARCH_API_URL,
    market: env.XMPP_MARKET_API_URL,
    stream: env.XMPP_STREAM_API_URL,
  },
  contracts: {
    policyContractId: env.XMPP_POLICY_CONTRACT_ID,
    sessionRegistryContractId: env.XMPP_SESSION_REGISTRY_CONTRACT_ID,
  },
} as const
