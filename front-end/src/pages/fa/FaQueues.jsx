'use strict';

import * as actions from './faActions.js';
import { selectAndReveal } from './faHelpers.js';
import StatusBadge from './StatusBadge.jsx';
import * as S from './faStyles.js';

/**
 * The work queues that used to make up the FA Dashboard view, now shown at
 * the top of the view that acts on them:
 *
 *  - LedgerQueues   (Ledger view)  KPI counts, the patient billing queue, and
 *                   new admissions awaiting a ledger.
 *  - DischargeQueue (EOD & Settlement view)  patients HOM has cleared for
 *                   discharge / OPD visits ready to settle.
 *
 * Picking a patient selects them for the detail section below and scrolls
 * to it, instead of switching views.
 */

function Panel({ title, badge, headers, children, style }) {
  return (
    <div className="card" style={{ ...S.cardFlush, ...style }}>
      <div style={badge ? S.panelHeaderSplit : S.panelHeader}>
        <h3 style={S.panelTitle}>{title}</h3>
        {badge}
      </div>
      <table className="data-table" style={S.tableStyle}>
        <thead style={S.theadStyle}>
          <tr>
            {headers.map((h) => (
              <th key={h} style={S.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} style={S.emptyCell}>
        {message}
      </td>
    </tr>
  );
}

function dischargeReadyRows(rows) {
  return rows.filter(
    (r) => r.dischargeApproved && r.admission.status !== 'DISCHARGED' && r.ledger?.status !== 'PAID',
  );
}

export function LedgerQueues({ rows, ctx, detailId }) {
  const activeRows = rows.filter((r) => r.admission.status !== 'DISCHARGED');
  const pendingLedger = activeRows.filter((r) => !r.ledger);
  const dischargeReady = dischargeReadyRows(rows);

  return (
    <>
      <h2 style={S.pageTitle}>Running Ledgers</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {[
          ['Active IPD', activeRows.length, 'var(--color-accent)'],
          ['Ledgers Pending Setup', pendingLedger.length, 'var(--color-accent)'],
          ['HOM Discharge Ready', dischargeReady.length, 'var(--status-error)'],
        ].map(([label, value, color]) => (
          <div className="card" style={{ padding: '20px', marginBottom: 0 }} key={label}>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                fontWeight: 700,
                marginBottom: '12px',
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      <Panel
        title="New Admissions Awaiting Ledger Setup"
        badge={
          <span className={'badge ' + (pendingLedger.length ? 'badge-warning' : 'badge-success')}>
            {pendingLedger.length} Pending
          </span>
        }
        headers={['Patient', 'UHID', 'Bed', 'Requested By', 'Action']}
        style={{ marginTop: '32px' }}
      >
        {pendingLedger.length === 0 ? (
          <EmptyRow colSpan={5} message="No ledger setup requests are pending." />
        ) : (
          pendingLedger.map((r) => (
            <tr key={r.admission.admission_id}>
              <td style={S.td}>
                <strong>{r.patient.name || '-'}</strong>
              </td>
              <td style={S.td}>{r.patient.uhid || '-'}</td>
              <td style={S.td}>{r.bed.bed_number || '-'}</td>
              <td style={S.td}>HOM</td>
              <td style={S.td}>
                <button
                  className="btn-primary"
                  style={S.smallerBtn}
                  onClick={() => actions.createLedgerAndOpen(ctx, r.admission.admission_id)}
                >
                  Create Ledger
                </button>
              </td>
            </tr>
          ))
        )}
      </Panel>

      <Panel
        title="Patient Billing Queue"
        headers={['Admission', 'Patient', 'Bed', 'Status', 'Action']}
        style={{ marginTop: '24px', marginBottom: '32px' }}
      >
        {activeRows.length === 0 ? (
          <EmptyRow colSpan={5} message="No patients found in queue." />
        ) : (
          activeRows.map((r) => (
            <tr key={r.admission.admission_id}>
              <td style={S.td}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
                  {r.admission.admission_id}
                </span>
              </td>
              <td style={S.td}>
                <strong>{r.patient.name || '-'}</strong>
              </td>
              <td style={S.td}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
                  {r.bed.bed_number || '-'}
                </span>
              </td>
              <td style={S.td}>
                <StatusBadge row={r} />
              </td>
              <td style={S.td}>
                <button
                  className="btn-primary"
                  style={S.smallBtn}
                  onClick={() => {
                    if (r.ledger) {
                      selectAndReveal(ctx, '#/ledger', r.admission.admission_id, detailId);
                    } else {
                      actions.createLedgerAndOpen(ctx, r.admission.admission_id);
                    }
                  }}
                >
                  {r.ledger ? 'Open Ledger' : 'Create Ledger'}
                </button>
              </td>
            </tr>
          ))
        )}
      </Panel>
    </>
  );
}

export function DischargeQueue({ rows, ctx, detailId }) {
  const dischargeReady = dischargeReadyRows(rows);

  return (
    <Panel
      title="HOM Requests: Discharge & Final Billing"
      badge={
        <span className={'badge ' + (dischargeReady.length ? 'badge-warning' : 'badge-success')}>
          {dischargeReady.length} Open
        </span>
      }
      headers={['Patient', 'Admission', 'Bed', 'Status', 'Action']}
      style={{ marginBottom: '32px' }}
    >
      {dischargeReady.length === 0 ? (
        <EmptyRow colSpan={5} message="No discharge requests from HOM." />
      ) : (
        dischargeReady.map((r) => (
          <tr key={r.admission.admission_id}>
            <td style={S.td}>
              <strong>{r.patient.name || '-'}</strong>
            </td>
            <td style={S.td}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
                {r.admission.admission_id}
              </span>
            </td>
            <td style={S.td}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
                {r.bed.bed_number || '-'}
              </span>
            </td>
            <td style={S.td}>
              <span className="badge badge-warning">
                {r.admission.visit_type === 'OPD' ? 'OPD Visit' : 'HOM Approved'}
              </span>
            </td>
            <td style={S.td}>
              <button
                className="btn-primary"
                style={S.smallerBtn}
                onClick={() => selectAndReveal(ctx, '#/eod', r.admission.admission_id, detailId)}
              >
                Open Billing
              </button>
            </td>
          </tr>
        ))
      )}
    </Panel>
  );
}
