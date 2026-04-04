import './globals.css'

export const metadata = {
  title: 'xMPP',
  description:
    'The payment routing brain for autonomous agents on Stellar. x402 + MPP routing, operator policy control, and contract-backed treasury.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
