'use strict';

import { useState } from 'react';
import Modal from '../../components/layout/Modal.jsx';
import { formatCurrency } from './homHelpers.js';
import { itemCost, findPatientByUhid, validateUsageDetails } from './inventoryHelpers.js';

/** Ported from #modal-log-usage plus openLogUsageModal / submitModalUsage in HOM/inventory.js. */
export default function LogUsageModal({ open, initialItemId, data, onClose, onSubmit }) {
  // Mounted only while open (re-keyed per item), so each opening starts fresh.
  if (!open) return null;
  return (
    <LogUsageForm key={initialItemId ?? 'none'} initialItemId={initialItemId} data={data} onClose={onClose} onSubmit={onSubmit} />
  );
}

function LogUsageForm({ initialItemId, data, onClose, onSubmit }) {
  const [itemId, setItemId] = useState(initialItemId ? String(initialItemId) : '');
  const [uhid, setUhid] = useState('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');

  const item = data.items.find((i) => i.item_id === Number(itemId));
  const cost = itemCost(item, data.services);
  const patient = findPatientByUhid(uhid, data.patients);

  async function submit() {
    const err = validateUsageDetails({ uhid: uhid.trim(), itemId: Number(itemId), qty: Number(qty) }, data);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    try {
      await onSubmit(uhid.trim(), Number(itemId), Number(qty));
    } catch (e) {
      setError(e.message || 'Unable to record supply usage.');
      return;
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="h2" style={{ fontSize: 20 }}>Log Inventory Usage</h2>
          <button className="btn btn-outline btn-sm" style={{ border: 'none', padding: '4px 8px' }} onClick={onClose}>{'✕'}</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Supply Item *</label>
            <select className="input" id="modal-item-select" style={{ appearance: 'auto' }} value={itemId} onChange={(e) => { setItemId(e.target.value); setError(''); }}>
              <option value="">Select supply item...</option>
              {data.items.map((i) => (
                <option key={i.item_id} value={i.item_id}>{i.item_name} ({i.stock_quantity} available)</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Patient UHID *</label>
            <input type="text" className="input" id="modal-uhid" placeholder="Enter UHID (e.g., FED-2026-8901)"
              value={uhid} onChange={(e) => { setUhid(e.target.value); setError(''); }} />
          </div>

          <div id="modal-patient-box" style={{ display: patient ? 'block' : 'none', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-base)', padding: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }} id="modal-patient-name">
              {patient ? '✓ Patient: ' + patient.name : 'Patient: '}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Quantity *</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="stepper-btn" onClick={() => setQty((v) => Math.max(1, v - 1))}>{'−'}</button>
              <input type="number" className="stepper-input" id="modal-qty" value={qty} readOnly />
              <button className="stepper-btn" onClick={() => setQty((v) => Math.max(1, v + 1))}>+</button>
            </div>
          </div>

          <div style={{ background: 'var(--neutral-bg)', padding: 16, borderRadius: 'var(--radius-base)' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
              Cost preview:{' '}
              <span id="modal-calc-text">
                {!item ? '₹0 × 1 = ' : cost === null ? 'Non-billable supply — ' : formatCurrency(cost) + ' × ' + qty + ' = '}
              </span>{' '}
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} id="modal-total-cost">
                {!item ? '₹0' : cost === null ? 'Stock Only' : formatCurrency(cost * qty)}
              </span>
            </p>
          </div>

          <div style={{ background: 'var(--info-bg)', borderRadius: 'var(--radius-base)', padding: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--info-text)', margin: 0 }}>
              This charge will be posted to the patient&apos;s administrative billing ledger.
            </p>
          </div>

          <div id="modal-usage-error" style={{ display: error ? 'block' : 'none', fontSize: 12, color: 'var(--error)', fontWeight: 500 }}>{error}</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-default" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-default" onClick={submit}>Post to Ledger</button>
        </div>
      </div>
    </Modal>
  );
}

