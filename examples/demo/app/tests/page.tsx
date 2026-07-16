'use client'

import { useState } from 'react'
import {
  Plus,
  CalendarClock,
  Play,
  MoreHorizontal,
} from 'lucide-react'
import './tests.css'

type Verdict = 'Passed' | 'Failed' | 'Blocked' | 'Aborted'

interface TestRow {
  name: string
  url: string
  verdict: Verdict
  when: string
  schedule: string
}

const TESTS: TestRow[] = [
  {
    name: 'Checkout — Place Order',
    url: 'shop.acme.com/cart',
    verdict: 'Failed',
    when: '2m ago',
    schedule: 'Every 15 min',
  },
  {
    name: 'Signup — Email verification',
    url: 'acme.com/signup',
    verdict: 'Failed',
    when: '2m ago',
    schedule: 'Every 15 min',
  },
  {
    name: 'Homepage smoke test',
    url: 'acme.com',
    verdict: 'Passed',
    when: '14m ago',
    schedule: 'Every 1 hour',
  },
  {
    name: 'Search returns results',
    url: 'acme.com/search',
    verdict: 'Passed',
    when: '1h ago',
    schedule: 'Every 6 hours',
  },
  {
    name: 'Booking flow — reserve seat',
    url: 'book.acme.com',
    verdict: 'Blocked',
    when: '3h ago',
    schedule: 'On deploy',
  },
  {
    name: 'Pricing loads all plans',
    url: 'acme.com/pricing',
    verdict: 'Passed',
    when: '5h ago',
    schedule: 'Daily',
  },
  {
    name: 'Add to cart from PDP',
    url: 'shop.acme.com/p/123',
    verdict: 'Passed',
    when: '6h ago',
    schedule: 'Every 1 hour',
  },
  {
    name: 'Account settings update',
    url: 'app.acme.com/settings',
    verdict: 'Aborted',
    when: '8h ago',
    schedule: 'Manual',
  },
  {
    name: 'Password reset flow',
    url: 'acme.com/reset',
    verdict: 'Passed',
    when: '1d ago',
    schedule: 'Daily',
  },
  {
    name: 'Contact form submit',
    url: 'acme.com/contact',
    verdict: 'Passed',
    when: '1d ago',
    schedule: 'Manual',
  },
]

type FilterId = 'All' | 'Passing' | 'Failing' | 'Blocked' | 'Scheduled'

const FILTERS: { id: FilterId; label: string; count: number }[] = [
  { id: 'All', label: 'All', count: 21 },
  { id: 'Passing', label: 'Passing', count: 18 },
  { id: 'Failing', label: 'Failing', count: 2 },
  { id: 'Blocked', label: 'Blocked', count: 1 },
  { id: 'Scheduled', label: 'Scheduled', count: 8 },
]

function matchesFilter(row: TestRow, filter: FilterId): boolean {
  switch (filter) {
    case 'Passing':
      return row.verdict === 'Passed'
    case 'Failing':
      return row.verdict === 'Failed'
    case 'Blocked':
      return row.verdict === 'Blocked'
    case 'Scheduled':
      return row.schedule !== 'Manual'
    case 'All':
    default:
      return true
  }
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const className = `verdict verdict-${verdict.toLowerCase()}`
  return (
    <span className={className}>
      <span className="verdict-dot" aria-hidden="true" />
      {verdict}
    </span>
  )
}

export default function TestsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('All')

  const visibleTests = TESTS.filter((row) => matchesFilter(row, activeFilter))

  return (
    <>
      <div className="page-header">
        <div className="page-header-titles">
          <h1 className="page-title">Tests</h1>
          <p className="page-subtitle">21 tests across 3 sites</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary">
            <Plus aria-hidden="true" />
            New test
          </button>
        </div>
      </div>

      <div className="tests-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filter tests">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.id}
              className={
                activeFilter === filter.id ? 'filter-tab active' : 'filter-tab'
              }
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
              <span className="count">{filter.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="data-table">
        <div className="data-head">
          <div className="tests-col-test">Test</div>
          <div className="tests-col-result">Last result</div>
          <div className="tests-col-schedule">Schedule</div>
          <div className="tests-col-actions" aria-hidden="true" />
        </div>

        {visibleTests.length === 0 ? (
          <div className="tests-empty">No tests match this filter.</div>
        ) : (
          visibleTests.map((row) => (
            <div className="data-row" key={row.name}>
              <div className="tests-col-test test-cell">
                <span className="test-name">{row.name}</span>
                <span className="test-url mono">{row.url}</span>
              </div>

              <div className="tests-col-result">
                <VerdictBadge verdict={row.verdict} />
                <span className="data-meta">{row.when}</span>
              </div>

              <div className="tests-col-schedule">
                <CalendarClock aria-hidden="true" />
                <span>{row.schedule}</span>
              </div>

              <div className="tests-col-actions">
                <div className="data-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Run ${row.name}`}
                  >
                    <Play aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`More actions for ${row.name}`}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
