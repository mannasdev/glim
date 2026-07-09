'use client'

import { useState } from 'react'

interface LiveListingData {
  name: string
  location: string
  nightlyRate: string
  photoGradient: string
}

const liveListings: LiveListingData[] = [
  {
    name: 'Driftwood Cottage',
    location: 'Mendocino, California',
    nightlyRate: '$240 / night',
    photoGradient: 'linear-gradient(135deg, #2c5364, #0f2027)',
  },
  {
    name: 'Sunset Loft',
    location: 'Lisbon, Portugal',
    nightlyRate: '$180 / night',
    photoGradient: 'linear-gradient(135deg, #b34733, #23074d)',
  },
]

export default function ListingsPage() {
  const [casaAzulStatus, setCasaAzulStatus] = useState<'draft' | 'live'>('draft')

  return (
    <>
      <div className="page-heading">
        <h1>Your listings</h1>
        <p className="page-subtitle">Everything you host, in one place.</p>
      </div>

      <div className="listings-grid">
        <article className="listing-card">
          <div
            className="listing-photo"
            style={{ background: 'linear-gradient(135deg, #1a6ea0, #12324d)' }}
          />
          <div className="listing-body">
            <div className="listing-title-row">
              <h2>Casa Azul</h2>
              <span
                className={
                  casaAzulStatus === 'live'
                    ? 'status-badge status-live'
                    : 'status-badge status-draft'
                }
              >
                {casaAzulStatus === 'live' ? 'Live' : 'Draft'}
              </span>
            </div>
            <p className="listing-meta">Sayulita, Mexico · $210 / night</p>
            {casaAzulStatus === 'draft' ? (
              <button
                className="primary-button"
                onClick={() => setCasaAzulStatus('live')}
              >
                Publish
              </button>
            ) : (
              <p className="listing-live-note">Accepting bookings</p>
            )}
          </div>
        </article>

        {liveListings.map((liveListing) => (
          <article className="listing-card" key={liveListing.name}>
            <div
              className="listing-photo"
              style={{ background: liveListing.photoGradient }}
            />
            <div className="listing-body">
              <div className="listing-title-row">
                <h2>{liveListing.name}</h2>
                <span className="status-badge status-live">Live</span>
              </div>
              <p className="listing-meta">
                {liveListing.location} · {liveListing.nightlyRate}
              </p>
              <p className="listing-live-note">Accepting bookings</p>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
