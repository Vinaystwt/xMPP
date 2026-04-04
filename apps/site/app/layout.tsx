import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'xMPP Frontend Lab',
  description: 'Isolated frontend build surfaces for xMPP.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
