'use client'

import { useState } from 'react'
import './settings.css'

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="toggle-row">
      <div>
        <p className="toggle-label">{label}</p>
        <p className="toggle-description">{description}</p>
      </div>
      <button
        type="button"
        className={checked ? 'toggle-switch on' : 'toggle-switch'}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [orgName, setOrgName] = useState('Acme Inc')
  const [workspace, setWorkspace] = useState('acme')

  const [failureAlerts, setFailureAlerts] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(true)
  const [blockedRuns, setBlockedRuns] = useState(false)

  return (
    <div className="settings-page">
      <div className="page-header">
        <div className="page-header-titles">
          <h1 className="page-title">Org settings</h1>
          <p className="page-subtitle">Manage your recce workspace</p>
        </div>
      </div>

      <section className="section-stack">
        {/* Organization */}
        <div className="settings-section">
          <h2 className="settings-section-title">Organization</h2>
          <div className="settings-section-body">
            <div className="field">
              <label className="field-label" htmlFor="org-name">
                Org name
              </label>
              <input
                id="org-name"
                className="text-input"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="workspace-url">
                Workspace URL
              </label>
              <div className="field-suffix-wrap">
                <input
                  id="workspace-url"
                  className="text-input"
                  type="text"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  aria-describedby="workspace-suffix"
                />
                <span id="workspace-suffix" className="field-suffix mono">
                  .recce.dev
                </span>
              </div>
            </div>
          </div>

          <div className="settings-save-row">
            <button type="button" className="btn btn-primary btn-sm">
              Save changes
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section">
          <h2 className="settings-section-title">Notifications</h2>
          <div className="settings-toggles">
            <ToggleRow
              label="Failure alerts"
              description="Email me when a scheduled test starts failing."
              checked={failureAlerts}
              onChange={() => setFailureAlerts((v) => !v)}
            />
            <ToggleRow
              label="Weekly summary"
              description="A Monday digest of pass rates and slow flows."
              checked={weeklySummary}
              onChange={() => setWeeklySummary((v) => !v)}
            />
            <ToggleRow
              label="Blocked runs"
              description="Tell me when a run is blocked by infra or a CAPTCHA."
              checked={blockedRuns}
              onChange={() => setBlockedRuns((v) => !v)}
            />
          </div>
        </div>

        {/* Danger zone */}
        <div className="settings-section">
          <h2 className="settings-section-title">Danger zone</h2>
          <div className="settings-danger-row">
            <div className="settings-danger-copy">
              <p className="settings-danger-title">Delete organization</p>
              <p className="settings-danger-desc">
                Permanently remove the Acme workspace, its tests, and all run
                history. This can&rsquo;t be undone.
              </p>
            </div>
            <button type="button" className="btn btn-danger btn-sm">
              Delete organization
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
