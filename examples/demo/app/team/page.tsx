'use client'

import { useState } from 'react'
import { useGlim, useGlimTool } from '@glim-sdk/next'

interface TeamMemberData {
  name: string
  email: string
  role: string
}

const teamMembers: TeamMemberData[] = [
  { name: 'Maya Torres', email: 'maya@harbor.test', role: 'Owner' },
  { name: 'Jonah Reid', email: 'jonah@harbor.test', role: 'Manager' },
  { name: 'Priya Nair', email: 'priya@harbor.test', role: 'Cleaner' },
]

export default function TeamPage() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const glim = useGlim()

  // Lets the model open the invite dialog itself when a user asks it to.
  useGlimTool('open_invite_modal', 'opens the invite teammate dialog', () => {
    setIsInviteModalOpen(true)
    return 'modal is open'
  })

  return (
    <>
      <div className="page-heading">
        <h1>Team</h1>
        <p className="page-subtitle">People who help you run your rentals.</p>
      </div>

      <div className="team-toolbar">
        <button
          className="primary-button"
          onClick={() => setIsInviteModalOpen(true)}
        >
          Invite
        </button>
        <button
          className="link-button"
          onClick={() => glim.startGuide('invite-teammate')}
        >
          Show me how
        </button>
      </div>

      <ul className="member-list">
        {teamMembers.map((teamMember) => (
          <li className="member-row" key={teamMember.email}>
            <div>
              <p className="member-name">{teamMember.name}</p>
              <p className="member-email">{teamMember.email}</p>
            </div>
            <span className="member-role">{teamMember.role}</span>
          </li>
        ))}
      </ul>

      {isInviteModalOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-label="Invite a teammate"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            <h2>Invite a teammate</h2>
            <p className="modal-subtitle">
              They will get an email with a link to join your Harbor workspace.
            </p>
            <input
              className="text-input"
              type="email"
              placeholder="teammate@example.com"
              aria-label="Teammate email"
              value={inviteEmail}
              onChange={(changeEvent) => setInviteEmail(changeEvent.target.value)}
            />
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setIsInviteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setIsInviteModalOpen(false)
                  setInviteEmail('')
                }}
              >
                Send invite
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
