'use client'

import { useState } from 'react'

interface NotificationToggleRowProps {
  label: string
  description: string
  isEnabled: boolean
  onToggle: () => void
}

function NotificationToggleRow({
  label,
  description,
  isEnabled,
  onToggle,
}: NotificationToggleRowProps) {
  return (
    <div className="toggle-row">
      <div>
        <p className="toggle-label">{label}</p>
        <p className="toggle-description">{description}</p>
      </div>
      <button
        className={isEnabled ? 'toggle-switch toggle-switch-on' : 'toggle-switch'}
        role="switch"
        aria-checked={isEnabled}
        aria-label={label}
        onClick={onToggle}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [isBookingRequestNotificationEnabled, setIsBookingRequestNotificationEnabled] =
    useState(true)
  const [isNewReviewNotificationEnabled, setIsNewReviewNotificationEnabled] =
    useState(true)
  const [isPayoutNotificationEnabled, setIsPayoutNotificationEnabled] =
    useState(false)

  return (
    <>
      <div className="page-heading">
        <h1>Settings</h1>
        <p className="page-subtitle">Choose which emails Harbor sends you.</p>
      </div>

      <div className="settings-list">
        <NotificationToggleRow
          label="Booking requests"
          description="Email me when a guest requests to book one of my listings."
          isEnabled={isBookingRequestNotificationEnabled}
          onToggle={() =>
            setIsBookingRequestNotificationEnabled(
              !isBookingRequestNotificationEnabled,
            )
          }
        />
        <NotificationToggleRow
          label="New reviews"
          description="Email me when a guest leaves a review."
          isEnabled={isNewReviewNotificationEnabled}
          onToggle={() =>
            setIsNewReviewNotificationEnabled(!isNewReviewNotificationEnabled)
          }
        />
        <NotificationToggleRow
          label="Payout confirmations"
          description="Email me when a payout lands in my bank account."
          isEnabled={isPayoutNotificationEnabled}
          onToggle={() =>
            setIsPayoutNotificationEnabled(!isPayoutNotificationEnabled)
          }
        />
      </div>
    </>
  )
}
