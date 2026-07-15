'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useGlimTool } from '@glim-sdk/next'
import {
  ScanEye,
  Plus,
  LayoutDashboard,
  ListChecks,
  CalendarClock,
  Users,
  KeyRound,
  CreditCard,
  Settings,
  ChevronsUpDown,
} from 'lucide-react'
import NewTestModal from './NewTestModal'

type NavLink = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const primaryNav: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tests', label: 'Tests', icon: ListChecks },
  { href: '/schedules', label: 'Schedules', icon: CalendarClock },
]

const settingsNav: NavLink[] = [
  { href: '/members', label: 'Members', icon: Users },
  { href: '/api-keys', label: 'API keys', icon: KeyRound },
  { href: '/billing', label: 'Usage & billing', icon: CreditCard },
  { href: '/settings', label: 'Org settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [newTestOpen, setNewTestOpen] = useState(false)

  useGlimTool(
    'open_new_test',
    'opens the New test dialog so the user can describe a test',
    () => {
      setNewTestOpen(true)
      return 'the New test dialog is open'
    },
  )

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href

  const renderLink = ({ href, label, icon: Icon }: NavLink) => (
    <Link
      key={href}
      href={href}
      className={`side-nav-item${isActive(href) ? ' active' : ''}`}
      aria-current={isActive(href) ? 'page' : undefined}
    >
      <Icon strokeWidth={2} />
      <span>{label}</span>
    </Link>
  )

  return (
    <>
      <nav className="app-sidebar" aria-label="Primary">
        <div className="sidebar-logo">
          <span className="brand-mark" aria-hidden="true">
            <ScanEye size={16} strokeWidth={2} />
          </span>
          <span className="brand-word">recce</span>
        </div>

        <button
          type="button"
          className="new-test-btn"
          onClick={() => setNewTestOpen(true)}
        >
          <Plus size={16} strokeWidth={2} />
          <span>New test</span>
        </button>

        <div className="side-nav">{primaryNav.map(renderLink)}</div>

        <div className="side-nav-section">Settings</div>

        <div className="side-nav">{settingsNav.map(renderLink)}</div>

        <div className="side-nav-spacer" />

        <button type="button" className="org-chip">
          <span className="org-avatar" aria-hidden="true">
            A
          </span>
          <span className="org-chip-text">
            <span className="org-name">Acme Inc</span>
            <span className="org-plan">Team plan</span>
          </span>
          <ChevronsUpDown strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>

      <NewTestModal open={newTestOpen} onClose={() => setNewTestOpen(false)} />
    </>
  )
}
