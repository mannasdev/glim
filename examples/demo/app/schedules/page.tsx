'use client'

import './schedules.css'

import { useState } from 'react'
import { Plus } from 'lucide-react'

type Verdict = 'passed' | 'failed' | 'blocked' | 'aborted'

interface ScheduleRow {
  name: string
  url: string
  cadence: string
  nextRun: string
  verdict: Verdict
  verdictLabel: string
  active: boolean
}

const initialSchedules: ScheduleRow[] = [
  {
    name: 'Checkout — Place Order',
    url: 'shop.acme.com/cart',
    cadence: 'Every 15 min',
    nextRun: 'in 12 min',
    verdict: 'failed',
    verdictLabel: 'Failed',
    active: true,
  },
  {
    name: 'Signup — Email verification',
    url: 'acme.com/signup',
    cadence: 'Every 15 min',
    nextRun: 'in 12 min',
    verdict: 'failed',
    verdictLabel: 'Failed',
    active: true,
  },
  {
    name: 'Homepage smoke test',
    url: 'acme.com',
    cadence: 'Every 1 hour',
    nextRun: 'in 46 min',
    verdict: 'passed',
    verdictLabel: 'Passed',
    active: true,
  },
  {
    name: 'Add to cart from PDP',
    url: 'shop.acme.com/p/123',
    cadence: 'Every 1 hour',
    nextRun: 'in 46 min',
    verdict: 'passed',
    verdictLabel: 'Passed',
    active: true,
  },
  {
    name: 'Search returns results',
    url: 'acme.com/search',
    cadence: 'Every 6 hours',
    nextRun: 'in 2h 10m',
    verdict: 'passed',
    verdictLabel: 'Passed',
    active: true,
  },
  {
    name: 'Pricing loads all plans',
    url: 'acme.com/pricing',
    cadence: 'Daily',
    nextRun: 'tomorrow 09:00',
    verdict: 'passed',
    verdictLabel: 'Passed',
    active: true,
  },
  {
    name: 'Password reset flow',
    url: 'acme.com/reset',
    cadence: 'Daily',
    nextRun: 'tomorrow 09:00',
    verdict: 'passed',
    verdictLabel: 'Passed',
    active: true,
  },
  {
    name: 'Booking flow — reserve seat',
    url: 'book.acme.com',
    cadence: 'On deploy',
    nextRun: 'on next deploy',
    verdict: 'blocked',
    verdictLabel: 'Blocked',
    active: true,
  },
]

const testOptions = initialSchedules.map((row) => row.name)

const cadenceOptions = [
  'Every 15 min',
  'Every 1 hour',
  'Every 6 hours',
  'Daily',
  'On deploy',
]

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleRow[]>(initialSchedules)
  const [modalOpen, setModalOpen] = useState(false)

  function toggleActive(index: number) {
    setSchedules((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, active: !row.active } : row,
      ),
    )
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-titles">
          <h1 className="page-title">Schedules</h1>
          <p className="page-subtitle">8 tests run automatically</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
          >
            <Plus aria-hidden="true" />
            New schedule
          </button>
        </div>
      </div>

      <div className="data-table">
        <div className="data-head">
          <span className="schedules-col-test">Test</span>
          <span className="schedules-col-cadence">Cadence</span>
          <span className="schedules-col-next">Next run</span>
          <span className="schedules-col-result">Last result</span>
          <span className="schedules-col-active">Active</span>
        </div>

        {schedules.map((row, index) => (
          <div className="data-row" key={row.name}>
            <div className="schedules-col-test test-cell">
              <span className="test-name">{row.name}</span>
              <span className="test-url mono">{row.url}</span>
            </div>

            <span className="schedules-col-cadence schedules-cell-text">
              {row.cadence}
            </span>

            <span className="schedules-col-next schedules-cell-muted">
              {row.nextRun}
            </span>

            <span className="schedules-col-result">
              <span className={`verdict verdict-${row.verdict}`}>
                <span className="verdict-dot" aria-hidden="true" />
                {row.verdictLabel}
              </span>
            </span>

            <span className="schedules-col-active">
              <button
                type="button"
                role="switch"
                aria-checked={row.active}
                aria-label={`${row.active ? 'Pause' : 'Resume'} schedule for ${row.name}`}
                className={`toggle-switch${row.active ? ' on' : ''}`}
                onClick={() => toggleActive(index)}
              >
                <span className="toggle-knob" />
              </button>
            </span>
          </div>
        ))}
      </div>

      {modalOpen && (
        <NewScheduleModal onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}

function NewScheduleModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-schedule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="new-schedule-title">
          New schedule
        </h2>
        <p className="modal-subtitle">
          Pick a test and how often recce should run it around the clock.
        </p>

        <div className="field">
          <label className="field-label" htmlFor="schedule-test">
            Test
          </label>
          <select
            className="select"
            id="schedule-test"
            defaultValue={testOptions[0]}
          >
            {testOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="schedule-cadence">
            Cadence
          </label>
          <select
            className="select"
            id="schedule-cadence"
            defaultValue={cadenceOptions[0]}
          >
            {cadenceOptions.map((cadence) => (
              <option key={cadence} value={cadence}>
                {cadence}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Create schedule
          </button>
        </div>
      </div>
    </div>
  )
}
