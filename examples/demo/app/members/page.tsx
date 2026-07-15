'use client'

import { useState } from 'react'
import { useGlim, useGlimTool } from '@glim-sdk/next'
import './members.css'

type Role = 'Owner' | 'Admin' | 'Member'

type Member = {
  name: string
  email: string
  role: Role
}

const members: Member[] = [
  { name: 'Maya Chen', email: 'maya@acme.com', role: 'Owner' },
  { name: 'Jonah Reid', email: 'jonah@acme.com', role: 'Admin' },
  { name: 'Priya Nair', email: 'priya@acme.com', role: 'Member' },
  { name: 'Diego Alvarez', email: 'diego@acme.com', role: 'Member' },
  { name: 'Sara Kim', email: 'sara@acme.com', role: 'Member' },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export default function MembersPage() {
  const glim = useGlim()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('Member')

  // Let the model open the invite dialog mid-conversation.
  useGlimTool(
    'open_invite_modal',
    'opens the invite-teammate dialog',
    () => {
      setInviteOpen(true)
      return 'the invite dialog is open'
    },
  )

  const closeInvite = () => {
    setInviteOpen(false)
    setEmail('')
    setRole('Member')
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-titles">
          <h1 className="page-title">Members</h1>
          <p className="page-subtitle">People in the Acme workspace</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => glim.startGuide('invite-member')}
          >
            Show me how
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setInviteOpen(true)}
          >
            Invite
          </button>
        </div>
      </div>

      <div className="data-table">
        <div className="data-head">
          <span className="members-col-member">Member</span>
          <span className="members-col-email">Email</span>
          <span className="members-col-role">Role</span>
        </div>
        {members.map((member) => (
          <div className="data-row" key={member.email}>
            <div className="members-col-member">
              <div className="members-identity">
                <span className="members-avatar" aria-hidden="true">
                  {initials(member.name)}
                </span>
                <span className="members-name">{member.name}</span>
              </div>
            </div>
            <div className="members-col-email">
              <span className="members-email mono">{member.email}</span>
            </div>
            <div className="members-col-role">
              <span className="role-badge">{member.role}</span>
            </div>
          </div>
        ))}
      </div>

      {inviteOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeInvite}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title" id="invite-title">
              Invite a teammate
            </h2>
            <p className="modal-subtitle">
              They&rsquo;ll get a link to join the Acme workspace.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                closeInvite()
              }}
            >
              <div className="field">
                <label className="field-label" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  className="text-input"
                  placeholder="teammate@acme.com"
                  aria-label="Teammate email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  className="select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeInvite}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
