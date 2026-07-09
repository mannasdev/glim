import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { GlimProvider } from '@glim-sdk/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Harbor',
  description: 'Manage your vacation rentals in one place.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlimProvider>
          <header className="site-header">
            <div className="site-header-inner">
              <span className="site-logo">Harbor</span>
              <nav className="site-nav">
                <Link href="/">Listings</Link>
                <Link href="/team">Team</Link>
                <Link href="/settings">Settings</Link>
              </nav>
            </div>
          </header>
          <main className="page">{children}</main>
        </GlimProvider>
      </body>
    </html>
  )
}
