'use strict';

import { useEffect, useState } from 'react';
import DialogShell from '../../components/layout/DialogShell.jsx';
import Badge from '../../components/ui/Badge.jsx';
import TabNav from '../../components/ui/TabNav.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { api } from '../../api/index.js';
import { statusLabel, statusVariant, daysSince, formatDate, formatCurrency } from './homHelpers.js';

/**
 * Ported from #modal-patient-detail plus openPatientDetail in HOM/patient-flow.js.
 *
 * The ledger lookup is the same two-step the original did: find the patient's
 * billing bundle, then fetch that ledger's entries.
 *
 * The "Billing Ledger" tab is HOM's read-only view of a patient's charges;
 * full accounting lives in the FA portal. The parent keys this modal by
 * patient row, so each opening starts on `initialTab`.
 */
export default function PatientDetailModal({ row, initialTab = 'overview', onClose, onOpenDischarge }) {
  const [tab, setTab] = useState(initialTab);
  const [billing, setBilling] = useState(null);
  const [entries, setEntries] = useState([]);
  const [servicesById, setServicesById] = useState({});

  useEffect(() => {
    if (!row) return;
    let cancelled = false;

    (async () => {
      let bundle = null;
      try {
        const bills = await api.billing.patient.bills(row.patient_id);
        bundle = bills.find((b) => b.ledger) || bills[0] || null;
      } catch {
        bundle = null;
      }
      const [ledgerEntries, services] = await Promise.all([
        bundle && bundle.ledger ? api.billing.ledger.entries(bundle.ledger.ledger_id).catch(() => []) : Promise.resolve([]),
        api.billing.services.list().catch(() => []),
      ]);
      if (cancelled) return;
      const map = {};
      (services || []).forEach((s) => (map[s.service_id] = s));
      setBilling(bundle);
      setEntries(ledgerEntries || []);
      setServicesById(map);
    })();

    return () => { cancelled = true; };
  }, [row]);

  if (!row) return null;

  const total = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const field = (label, value) => (
    <div>
      <div className="label">{label}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <DialogShell
      open
      onClose={onClose}
      size="lg"
      title={row.patientName}
      subtitle={`${row.patientUhid} • ${row.department || '-'}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, width: '100%' }}>
          <button className="btn btn-secondary btn-default" onClick={onClose}>Close</button>
          <button className="btn btn-outline btn-default" data-flow="goto-billing" onClick={() => setTab('supply')}>
            View Billing Ledger
          </button>
          {row.status === 'DISCHARGE_REQUESTED' ? (
            <button className="btn btn-primary btn-default" id="btn-pd-discharge" onClick={() => onOpenDischarge(row.pre_request_id)}>
              Approve Discharge
            </button>
          ) : null}
        </div>
      }
    >
      <div>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <TabNav
            tabs={[
              { id: 'overview', label: 'Overview & Ward Care' },
              { id: 'supply', label: 'Billing Ledger' },
            ]}
            activeTab={tab}
            onTabChange={setTab}
          />
          <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
        </div>

        <div className={'tab-content-panel' + (tab === 'overview' ? ' active' : '')} id="content-overview">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {field('Age / Gender', row.patientAge + ' / ' + row.patientGender)}
            {field('Contact Number', row.patientPhone)}
            {field('Blood Group', row.patientBloodGroup)}
            {field('Department', row.department || '-')}
            {field('Assigned Bed', row.bedNumber)}
            {field('Attending Physician', row.doctorName)}
            {field('Admission Date', formatDate(row.decided_at || row.created_at))}
            {field('Length of Stay', daysSince(row.decided_at || row.created_at) + ' days')}
          </div>
        </div>

        <div className={'tab-content-panel' + (tab === 'supply' ? ' active' : '')} id="content-supply">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
            Ledger Status:{' '}
            <span id="pd-ledger-status" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {billing && billing.ledger ? billing.ledger.status : 'No ledger yet'}
            </span>
          </p>
          <div className="table-scroll-container" style={{ maxHeight: 240, marginBottom: 16 }}>
            <table className="data-table">
              <thead><tr><th>Service / Item</th><th>Qty</th><th>Amount</th></tr></thead>
              <tbody id="pd-charges-tbody">
                {entries.length === 0 ? (
                  <EmptyState asTableRow colSpan={3} title="No billing ledger entries yet." />
                ) : (
                  entries.map((e) => (
                    <tr key={e.entry_id}>
                      <td>{servicesById[e.service_id]?.service_name || 'Service #' + e.service_id}</td>
                      <td>{e.quantity}</td>
                      <td>{formatCurrency(e.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 16 }}>
            Total Billed: <span id="pd-charges-total" style={{ color: 'var(--primary)' }}>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

