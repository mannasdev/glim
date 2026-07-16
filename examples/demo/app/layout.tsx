import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { GlimProvider } from '@glim-sdk/next'
import Sidebar from './_components/Sidebar'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'recce',
  description:
    'Grounded AI QA that drives your real site and shows you the receipts.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <GlimProvider>
          <div className="app-shell">
            <Sidebar />
            <div className="app-main">
              <main className="app-content">{children}</main>
            </div>
          </div>
        </GlimProvider>
      </body>
    </html>
  )
}
