'use client'

import { useState } from 'react'
import { Plus, Copy, MoreHorizontal, Check } from 'lucide-react'
import './api-keys.css'

interface ApiKey {
  id: string
  name: string
  key: string
  created: string
  lastUsed: string
}

const apiKeys: ApiKey[] = [
  {
    id: 'ci-github',
    name: 'CI · GitHub Actions',
    key: 'rk_live_••••••••4f2a',
    created: 'Jun 3, 2026',
    lastUsed: '2m ago',
  },
  {
    id: 'ci-gitlab',
    name: 'CI · GitLab',
    key: 'rk_live_••••••••9b71',
    created: 'May 20, 2026',
    lastUsed: '1d ago',
  },
  {
    id: 'local-dev',
    name: 'Local dev',
    key: 'rk_live_••••••••0c55',
    created: 'Apr 12, 2026',
    lastUsed: '3w ago',
  },
]

// Demo-only: a plausible-looking freshly generated key shown once at creation.
const GENERATED_KEY = 'rk_live_7Qd2mVx9Ka4Lp0RtBhZ3nWc'

export default function ApiKeysPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  function openCreate() {
    setNewKeyName('')
    setGenerated(false)
    setCopied(false)
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
  }

  function handleCreate() {
    setGenerated(true)
  }

  async function copyGenerated() {
    try {
      await navigator.clipboard.writeText(GENERATED_KEY)
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — still show
      // the confirmation in the demo.
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-titles">
          <h1 className="page-title">API keys</h1>
          <p className="page-subtitle">Keys for CI and the recce API</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            Create key
          </button>
        </div>
      </div>

      <div className="data-table">
        <div className="data-head">
          <div className="apikeys-col-name">Name</div>
          <div className="apikeys-col-key">Key</div>
          <div className="apikeys-col-created">Created</div>
          <div className="apikeys-col-used">Last used</div>
          <div className="apikeys-col-actions" aria-hidden="true" />
        </div>

        {apiKeys.map((k) => (
          <div className="data-row" key={k.id}>
            <div className="apikeys-col-name">
              <span className="test-name">{k.name}</span>
            </div>
            <div className="apikeys-col-key">
              <span className="apikeys-key mono">{k.key}</span>
            </div>
            <div className="apikeys-col-created data-meta">{k.created}</div>
            <div className="apikeys-col-used data-meta">{k.lastUsed}</div>
            <div className="apikeys-col-actions">
              <div className="data-actions">
                <button
                  className="icon-btn"
                  aria-label={`Copy ${k.name} key`}
                  title="Copy key"
                >
                  <Copy aria-hidden="true" />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`More actions for ${k.name}`}
                  title="More"
                >
                  <MoreHorizontal aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeCreate}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-key-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title" id="create-key-title">
              Create API key
            </h2>

            {!generated ? (
              <>
                <p className="modal-subtitle">
                  Name this key so you know where it&rsquo;s used — CI, a script,
                  or a teammate&rsquo;s machine.
                </p>
                <div className="field">
                  <label className="field-label" htmlFor="new-key-name">
                    Name
                  </label>
                  <input
                    id="new-key-name"
                    className="text-input"
                    type="text"
                    placeholder="CI · GitHub Actions"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={closeCreate}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={newKeyName.trim() === ''}
                  >
                    Create key
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-subtitle">
                  Copy this key now — for your security it won&rsquo;t be shown
                  again.
                </p>
                <div className="field">
                  <span className="field-label">Your new key</span>
                  <div className="apikeys-generated">
                    <span className="apikeys-generated-key mono">
                      {GENERATED_KEY}
                    </span>
                    {copied ? (
                      <span className="apikeys-copied">Copied</span>
                    ) : (
                      <button
                        className="icon-btn"
                        onClick={copyGenerated}
                        aria-label="Copy new key"
                        title="Copy key"
                      >
                        <Copy aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="apikeys-generated-hint">
                    <Check aria-hidden="true" />
                    Store it in your CI secrets — recce never writes keys to
                    reports or logs.
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={closeCreate}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
