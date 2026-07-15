'use client'

import { useState } from 'react'

type NewTestModalProps = {
  open: boolean
  onClose: () => void
}

export default function NewTestModal({ open, onClose }: NewTestModalProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')

  if (!open) return null

  const reset = () => {
    setName('')
    setUrl('')
    setDescription('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    // Demo: creating a test just closes the dialog.
    handleClose()
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleCreate}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-test-title"
      >
        <h2 className="modal-title" id="new-test-title">
          New test
        </h2>
        <p className="modal-subtitle">
          Describe a flow and recce will drive your real site to check it.
        </p>

        <div className="field">
          <label className="field-label" htmlFor="new-test-name">
            Name
          </label>
          <input
            id="new-test-name"
            className="text-input"
            type="text"
            placeholder="Checkout — Place Order"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="new-test-url">
            URL
          </label>
          <input
            id="new-test-url"
            className="text-input mono"
            type="text"
            placeholder="shop.acme.com/cart"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="new-test-description">
            Describe the test in plain English
          </label>
          <textarea
            id="new-test-description"
            className="textarea"
            placeholder="Log in, add a widget to the cart, and check out. Make sure the order total shows and there's a Place Order button."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create test
          </button>
        </div>
      </form>
    </div>
  )
}
