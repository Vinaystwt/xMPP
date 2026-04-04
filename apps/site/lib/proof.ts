export type ProofTx = {
  route: string
  label: string
  colorToken: string
  hash: string
  display: string
  explorerUrl: string
}

export const PROOF_TXS: ProofTx[] = [
  {
    route: 'x402',
    label: 'x402 Smart Account',
    colorToken: 'var(--route-x402)',
    hash: '2cc2f8b5388e341e66a5ee68ebd000bf4804d314b82136d091e9b33dbdb37b5b',
    display: '2cc2f8b5...b37b5b',
    explorerUrl:
      'https://stellar.expert/explorer/testnet/tx/2cc2f8b5388e341e66a5ee68ebd000bf4804d314b82136d091e9b33dbdb37b5b',
  },
  {
    route: 'mpp-charge',
    label: 'mpp-charge',
    colorToken: 'var(--route-mpp-charge)',
    hash: '3125c05d57563e027717cc52eff478c6612cb55fcd57a2eaee21cd5f3241b34e',
    display: '3125c05d...241b34e',
    explorerUrl:
      'https://stellar.expert/explorer/testnet/tx/3125c05d57563e027717cc52eff478c6612cb55fcd57a2eaee21cd5f3241b34e',
  },
  {
    route: 'x402 preflight',
    label: 'x402 Preflight',
    colorToken: 'var(--route-x402)',
    hash: '16c3093215a363b79ed8a5678d9549236b8b7a74f2b818caa3c46d4c5155f1e5',
    display: '16c30932...155f1e5',
    explorerUrl:
      'https://stellar.expert/explorer/testnet/tx/16c3093215a363b79ed8a5678d9549236b8b7a74f2b818caa3c46d4c5155f1e5',
  },
]
