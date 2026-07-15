import './billing.css'
import { Check, Download } from 'lucide-react'

const invoices = [
  { date: 'Jul 1, 2026', amount: '$99.00', status: 'Paid' },
  { date: 'Jun 1, 2026', amount: '$99.00', status: 'Paid' },
  { date: 'May 1, 2026', amount: '$99.00', status: 'Paid' },
]

const features = [
  'Unlimited tests',
  'Scheduled monitoring',
  'CI + API access',
  'Email + webhook alerts',
]

export default function BillingPage() {
  return (
    <>
      <header className="page-header">
        <div className="page-header-titles">
          <h1 className="page-title">Usage &amp; billing</h1>
          <p className="page-subtitle">Team plan · renews Aug 1</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary">
            Upgrade plan
          </button>
        </div>
      </header>

      <div className="section-stack">
        {/* 1. This month */}
        <section className="card billing-card">
          <h2 className="billing-card-title">This month</h2>

          <div className="usage-meter billing-usage">
            <div className="meter-head">
              <span className="meter-title">Runs this month</span>
              <span className="meter-value">1,240 / 2,000</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: '62%' }} />
            </div>
            <p className="meter-caption">760 runs left · resets Aug 1</p>
          </div>

          <div className="billing-stats">
            <div className="billing-stat">
              <span className="billing-stat-label">Tests monitored</span>
              <span className="billing-stat-value">21</span>
            </div>
            <div className="billing-stat">
              <span className="billing-stat-label">Scheduled runs / day</span>
              <span className="billing-stat-value">~340</span>
            </div>
            <div className="billing-stat">
              <span className="billing-stat-label">Overage this month</span>
              <span className="billing-stat-value">$0.00</span>
            </div>
          </div>
        </section>

        {/* 2. Plan */}
        <section className="card billing-card">
          <div className="billing-plan-head">
            <h2 className="billing-plan-name">Team plan</h2>
            <span className="billing-plan-price">
              <strong>$99</strong> / month
            </span>
          </div>
          <p className="billing-plan-runs">2,000 test runs included</p>

          <ul className="billing-features">
            {features.map((feature) => (
              <li key={feature} className="billing-feature">
                <Check aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <span className="role-badge">Current plan</span>
        </section>

        {/* 3. Invoices */}
        <section className="data-table">
          <div className="data-head">
            <span className="billing-col-date">Date</span>
            <span className="billing-col-amount">Amount</span>
            <span className="billing-col-status">Status</span>
            <span className="billing-col-actions">Actions</span>
          </div>

          {invoices.map((invoice) => (
            <div className="data-row" key={invoice.date}>
              <span className="billing-col-date">{invoice.date}</span>
              <span className="billing-col-amount mono">{invoice.amount}</span>
              <span className="billing-col-status">
                <span className="verdict verdict-passed">
                  <span className="verdict-dot" />
                  {invoice.status}
                </span>
              </span>
              <div className="billing-col-actions data-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Download invoice from ${invoice.date}`}
                >
                  <Download aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
