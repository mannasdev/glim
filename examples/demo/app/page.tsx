import Link from 'next/link'
import { AlertTriangle, Search, RotateCcw } from 'lucide-react'
import './dashboard.css'

type Verdict = 'passed' | 'failed' | 'blocked' | 'aborted'

const VERDICT_LABEL: Record<Verdict, string> = {
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
  aborted: 'Aborted',
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`verdict verdict-${verdict}`}>
      <span className="verdict-dot" aria-hidden="true" />
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

interface RecentRun {
  name: string
  url: string
  verdict: Verdict
  time: string
  duration: string
}

const recentRuns: RecentRun[] = [
  { name: 'Checkout — Place Order', url: 'shop.acme.com/cart', verdict: 'failed', time: '2m ago', duration: '0:41' },
  { name: 'Signup — Email verification', url: 'acme.com/signup', verdict: 'failed', time: '2m ago', duration: '1:12' },
  { name: 'Homepage smoke test', url: 'acme.com', verdict: 'passed', time: '14m ago', duration: '0:29' },
  { name: 'Search returns results', url: 'acme.com/search', verdict: 'passed', time: '1h ago', duration: '0:38' },
  { name: 'Booking flow — reserve seat', url: 'book.acme.com', verdict: 'blocked', time: '3h ago', duration: '1:54' },
  { name: 'Pricing loads all plans', url: 'acme.com/pricing', verdict: 'passed', time: '5h ago', duration: '0:22' },
  { name: 'Account settings update', url: 'app.acme.com/settings', verdict: 'aborted', time: '8h ago', duration: '2:30' },
]

interface AttentionItem {
  name: string
  reason: string
}

const attentionItems: AttentionItem[] = [
  { name: 'Checkout — Place Order', reason: 'No Place Order button found' },
  { name: 'Signup — Email verification', reason: 'Verification email never arrived' },
]

export default function DashboardPage() {
  return (
    <>
      <div className="page-header">
        <div className="page-header-titles">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Monday, July 15 · all systems monitored</p>
        </div>
        <div className="page-header-actions">
          <div className="searchbox dash-search" role="search">
            <Search aria-hidden="true" />
            <span className="searchbox-text">Search tests</span>
            <span className="kbd">⌘K</span>
          </div>
        </div>
      </div>

      <div className="section-stack">
        {/* 1. Failing-tests alert */}
        <div className="alert-banner" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div className="alert-text">
            <p className="alert-title">2 tests are failing right now</p>
            <p className="alert-desc">
              Checkout — Place Order and Signup — Email verification started failing
              after this morning&apos;s deploy.
            </p>
          </div>
          <Link href="/tests" className="btn btn-secondary btn-sm">
            Review failures
          </Link>
        </div>

        {/* 2. Stat grid */}
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-label">Passing tests</span>
            <span className="stat-value">18</span>
            <span className="stat-sub">of 21 monitored</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Failing now</span>
            <span className="stat-value">2</span>
            <span className="stat-sub">checkout · signup</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Blocked (7d)</span>
            <span className="stat-value">1</span>
            <span className="stat-sub">couldn&apos;t complete</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg runtime</span>
            <span className="stat-value">0:48</span>
            <span className="stat-sub">per full run</span>
          </div>
        </div>

        {/* 3. Two-column region */}
        <div className="dash-cols">
          {/* LEFT — Recent runs */}
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Recent runs</h2>
              <Link href="/tests" className="link">
                View all runs
              </Link>
            </div>
            <div className="panel-body">
              {recentRuns.map((run) => (
                <div className="data-row dash-run-row" key={run.name}>
                  <div className="test-cell">
                    <span className="test-name">{run.name}</span>
                    <span className="test-url mono">{run.url}</span>
                  </div>
                  <div className="dash-run-verdict">
                    <VerdictBadge verdict={run.verdict} />
                  </div>
                  <span className="data-meta dash-run-time">{run.time}</span>
                  <span className="data-meta dash-run-duration mono">{run.duration}</span>
                </div>
              ))}
            </div>
          </section>

          {/* RIGHT — attention + usage */}
          <div className="dash-col-side">
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Needs attention</h2>
                <span className="dash-count-badge">2</span>
              </div>
              <div className="panel-body">
                {attentionItems.map((item) => (
                  <div className="dash-attention-row" key={item.name}>
                    <div className="dash-attention-text">
                      <span className="dash-attention-name">{item.name}</span>
                      <span className="dash-attention-reason">{item.reason}</span>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm">
                      <RotateCcw aria-hidden="true" />
                      Re-run
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="card dash-usage-card">
              <div className="dash-usage-head">
                <span className="dash-usage-label">Usage</span>
                <span className="dash-usage-plan">Team plan</span>
              </div>
              <div className="usage-meter">
                <div className="meter-head">
                  <span className="meter-title">Runs this month</span>
                  <span className="meter-value">1,240 / 2,000</span>
                </div>
                <div className="meter-track">
                  <div className="meter-fill" style={{ width: '62%' }} />
                </div>
                <span className="meter-caption">760 runs left · resets Aug 1</span>
              </div>
              <div className="dash-usage-footer">
                <span>Running low on a busy month?</span>
                <Link href="/billing" className="link">
                  Upgrade →
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
