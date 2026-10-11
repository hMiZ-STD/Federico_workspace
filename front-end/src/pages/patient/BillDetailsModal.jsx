'use strict';

import Modal from '../../components/layout/Modal.jsx';
import { forRole } from '../../lib/sanitizer.js';
import { BillStatusBadge } from './patientDashboardHelpers.jsx';
import { getEffectiveStatus } from './patientDashboardUtils.js';

/**
 * The patient's two bill dialogs:
 *
 *  - BillDetailsModal (default)  the itemized invoice for one bill, on the
 *                                Billing page.
 *  - BillSummaryModal            the dashboard's "View All" list of bills
 *                                (formerly BillsModal.jsx). Clicking a bill
 *                                opens its itemized invoice directly.
 *
 * The legacy invoice reconfigured the Pay button's text, opacity, cursor,
 * disabled flag and onclick imperatively in openBillModal; here the same
 * three states are conditional JSX.
 */
export function BillSummaryModal({ open, onClose, bills, onOpenBill, onGoToBilling }) {
  const unpaid = bills.filter((b) => getEffectiveStatus(b) !== 'paid');
  const totalOwed = unpaid.reduce((sum, b) => sum + b.youPay, 0);

  return (
    <Modal open={open} onClose={onClose} labelledBy="modal-bills-title">
      <div className="dash-modal" role="dialog" aria-modal="true" aria-labelledby="modal-bills-title">
        <div className="modal-head">
          <h2 id="modal-bills-title">Bill Summary</h2>
          <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px' }}>
                      No bills found.
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => {
                    // The row text comes from the sanitised copy; the amount is
                    // read off the original, exactly as the legacy code did.
                    const safeBill = forRole(bill, 'PATIENT');
                    return (
                      <tr
                        key={bill.id}
                        style={{ cursor: 'pointer' }}
                        tabIndex={0}
                        title="View itemized invoice"
                        onClick={() => onOpenBill(bill)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onOpenBill(bill);
                        }}
                      >
                        <td className="bill-id-cell">{safeBill.billNo}</td>
                        <td>{safeBill.description}</td>
                        <td>
                          <strong>₹{bill.youPay.toLocaleString('en-IN')}</strong>
                        </td>
                        <td>{safeBill.dueDate}</td>
                        <td>
                          <BillStatusBadge status={getEffectiveStatus(bill)} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="modal-bill-total">
            <span>Total Outstanding</span>
            <strong>₹{totalOwed.toLocaleString('en-IN')}</strong>
          </div>
          <div className="modal-footer-action">
            <button className="modal-book-btn" type="button" id="modal-go-bills" onClick={onGoToBilling}>
              View Full Billing Page →
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function BillDetailsModal({ open, onClose, bill, onPay, onPrint }) {
  if (!bill) return null;

  const statusText =
    bill.status === 'paid'
      ? 'PAID'
      : bill.hasDischargeSummary
        ? 'PENDING PAYMENT (DISCHARGED)'
        : 'INTERIM EOD STATEMENT';
  const statusColor =
    bill.status === 'paid'
      ? 'var(--success)'
      : bill.hasDischargeSummary
        ? 'var(--warn)'
        : 'var(--muted)';

  return (
    <Modal open={open} onClose={onClose} labelledBy="modal-bill-title">
      <div className="modal">
        <div className="modal-head">
          <h2 id="modal-bill-title">Itemized Invoice Details</h2>
          <button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-meta-row">
            <div className="modal-meta">
              <span>Invoice No</span>
              <strong id="modal-invoice-no">{bill.billNo || '#' + bill.ledgerId}</strong>
            </div>
            <div className="modal-meta">
              <span>Admission</span>
              <strong id="modal-admission-id">
                {bill.admissionId ? '#' + bill.admissionId : 'N/A'}
              </strong>
            </div>
            <div className="modal-meta">
              <span>Billing Date</span>
              <strong id="modal-bill-date">{bill.date || 'N/A'}</strong>
            </div>
            <div className="modal-meta">
              <span>Status</span>
              <strong id="modal-bill-status" style={{ color: statusColor }}>
                {statusText}
              </strong>
            </div>
          </div>

          <div className="table-wrap itemized-table">
            <table>
              <thead>
                <tr>
                  <th>Service / Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody id="modal-items-tbody">
                {bill.items && bill.items.length ? (
                  bill.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{item.name || 'Hospital Service'}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.qty || 1}</td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{Number(item.unitPrice || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{Number(item.total || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No line items recorded.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3">Gross Total</td>
                  <td style={{ textAlign: 'right' }} id="modal-gross-total">
                    ₹{Number(bill.total || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr className="ins-row">
                  <td colSpan="3">Insurance Covered Amount</td>
                  <td style={{ textAlign: 'right' }} id="modal-ins-deduction">
                    -₹{Number(bill.insuranceCovered || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr className="total-row">
                  <td colSpan="3">Net Patient Share (You Pay)</td>
                  <td style={{ textAlign: 'right' }} id="modal-net-payable">
                    ₹{Number(bill.youPay || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="modal-actions" id="modal-bill-actions">
            <button
              className="modal-btn-secondary"
              type="button"
              id="modal-btn-print"
              onClick={() => onPrint(bill)}
            >
              Print / Download
            </button>
            {bill.status === 'paid' ? null : !bill.hasDischargeSummary ? (
              <button
                className="btn-view"
                type="button"
                id="modal-btn-pay"
                disabled
                style={{ display: 'inline-flex', opacity: '0.6', cursor: 'not-allowed' }}
              >
                Payment Opens on Discharge
              </button>
            ) : (
              <button
                className="btn-view"
                type="button"
                id="modal-btn-pay"
                style={{ display: 'inline-flex', opacity: '1', cursor: 'pointer' }}
                onClick={() => onPay(bill)}
              >
                Pay Now
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
