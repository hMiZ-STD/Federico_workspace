'use strict';

import { useEffect, useState } from 'react';
import Modal from '../../components/layout/Modal.jsx';
import Badge from '../../components/ui/Badge.jsx';
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

  const initials = (row.patientName || '').split(' ').map((n) => n[0]).join('').slice(0, 2);
  const total = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const field = (label, value) => (
    <div>
      <div className="label">{label}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <Modal open onClose={onClose}>
      <div className="modal-content" style={{ maxWidth: 800 }}>
        <div className="modal-header" style={{ display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div className="avatar-circle" id="pd-avatar">{initials}</div>
              <div>
                <h2 className="h2" style={{ fontSize: 20 }} id="pd-name">{row.patientName}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 14 }}>
                  <span style={{ color: 'var(--text-secondary)' }} id="pd-uhid">{row.patientUhid}</span>
                  <span style={{ color: 'var(--border)' }}>{'·'}</span>
                  <span id="pd-status-badge"><Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge></span>
                  <span style={{ color: 'var(--border)' }}>{'·'}</span>
                  <span style={{ color: 'var(--text-secondary)' }} id="pd-dept">{row.department || '-'}</span>
                </div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ border: 'none', padding: '4px 8px' }} onClick={onClose}>{'✕'}</button>
          </div>

          <div className="modal-tabs">
            <button className={'modal-tab' + (tab === 'overview' ? ' active' : '')} id="tab-overview" onClick={() => setTab('overview')}>
              Overview &amp; Ward Care
            </button>
            <button className={'modal-tab' + (tab === 'supply' ? ' active' : '')} id="tab-supply" onClick={() => setTab('supply')}>
              Billing Ledger
            </button>
          </div>
        </div>

        <div className="modal-body">
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
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No billing ledger entries yet.</td></tr>
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

        <div className="modal-footer">
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
      </div>
    </Modal>
  );
}

