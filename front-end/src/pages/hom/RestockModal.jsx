'use strict';

import { useState } from 'react';
import DialogShell from '../../components/layout/DialogShell.jsx';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';
import { formatCurrency } from './homHelpers.js';
import { itemCost, DEFAULT_RESTOCK_QUANTITY, MAX_NOTES_LENGTH } from './inventoryHelpers.js';

/**
 * Ported from #modal-request-restock plus openRestockModal / submitRestock in
 * HOM/inventory.js.
 *
 * Upload order is load-bearing: the supplier invoice is uploaded first so its
 * URL can be attached to the purchase request itself. A failed upload aborts
 * the whole submit, exactly as before.
 */
export default function RestockModal({ open, initialItemId, data, onClose, onChanged }) {
  // Mounted only while open (re-keyed per item), so each opening starts fresh.
  if (!open) return null;
  return (
    <RestockForm key={initialItemId ?? 'none'} initialItemId={initialItemId} data={data} onClose={onClose} onChanged={onChanged} />
  );
}

function RestockForm({ initialItemId, data, onClose, onChanged }) {
  const [itemId, setItemId] = useState(initialItemId ? String(initialItemId) : '');
  const [qty, setQty] = useState(String(DEFAULT_RESTOCK_QUANTITY));
  const [supplier, setSupplier] = useState('MediSupply Co.');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [error, setError] = useState('');

  const item = data.items.find((i) => i.item_id === Number(itemId));
  const cost = itemCost(item, data.services);
  const quantityNum = Math.max(0, Number(qty) || 0);

  async function submit() {
    const item_id = Number(itemId);
    const quantity = Number(qty);
    const supplierName = supplier.trim();
    const noteText = notes.trim();
    const session = api.getSession();
    const selected = data.items.find((i) => i.item_id === item_id);

    if (!selected) {
      setError('Select an inventory supply item before submitting a purchase order.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Restock quantity must be a positive whole number greater than 0.');
      return;
    }
    if (!supplierName) {
      setError('Provide a supplier name for the purchase order.');
      return;
    }
    if (noteText.length > MAX_NOTES_LENGTH) {
      setError('Notes must be under ' + MAX_NOTES_LENGTH + ' characters.');
      return;
    }
    setError('');

    let invoiceUrl = null;
    if (invoiceFile) {
      setInvoiceStatus('Uploading invoice…');
      try {
        const uploaded = await api.uploads.inventory(invoiceFile);
        invoiceUrl = uploaded.url;
        setInvoiceStatus('Attached: ' + uploaded.originalName);
      } catch (err) {
        setError(err.message || 'Unable to upload the invoice file.');
        setInvoiceStatus('');
        return;
      }
    }

    try {
      await api.inventory.requests.create({
        item_id: selected.item_id,
        quantity_requested: quantity,
        status: 'PENDING',
        requested_by: session ? session.userId : null,
        invoice_url: invoiceUrl,
      });
      toast('Purchase Order submitted for ' + quantity + 'x ' + selected.item_name + '.', 'success');
    } catch (err) {
      setError(err.message || 'Unable to submit purchase order.');
      return;
    }

    onClose();
    await onChanged();
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      title="Request Restock / Purchase Order"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, width: '100%' }}>
          <button className="btn btn-secondary btn-default" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-default" onClick={submit}>Submit PO Request</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Supply Item *</label>
          <select className="input" id="restock-item-select" style={{ appearance: 'auto' }} value={itemId} onChange={(e) => { setItemId(e.target.value); setError(''); }}>
            <option value="">Select supply item...</option>
            {data.items.map((i) => (
              <option key={i.item_id} value={i.item_id}>{i.item_name} ({i.stock_quantity} available)</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Quantity *</label>
          <input type="number" className="input" id="restock-qty" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Supplier Name *</label>
          <input type="text" className="input" id="restock-supplier" placeholder="e.g. MediSupply Co., Global Health Logistics"
            value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Priority</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className={priority === 'normal' ? 'btn btn-primary btn-default' : 'btn btn-outline btn-default'} id="btn-priority-normal" style={{ flex: 1 }} onClick={() => setPriority('normal')}>
              Normal
            </button>
            <button className={priority === 'urgent' ? 'btn btn-primary btn-default' : 'btn btn-outline btn-default'} id="btn-priority-urgent" style={{ flex: 1 }} onClick={() => setPriority('urgent')}>
              Urgent
            </button>
          </div>
        </div>
        <div style={{ background: 'var(--neutral-bg)', padding: 16, borderRadius: 'var(--radius-base)' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            Estimated cost:{' '}
            <span id="restock-calc-text">
              {!item ? '₹0 × 0 = ' : cost === null ? 'No linked service rate — ' : formatCurrency(cost) + ' × ' + quantityNum + ' = '}
            </span>{' '}
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} id="restock-total-cost">
              {!item ? '₹0' : cost === null ? 'Estimate unavailable' : formatCurrency(cost * quantityNum)}
            </span>
          </p>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Notes (Optional)</label>
          <textarea className="input" id="restock-notes" style={{ height: 80, padding: 12, resize: 'none' }}
            placeholder="Add delivery or batch instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Supplier Invoice / Quote (Optional)</label>
          <input type="file" className="input" id="restock-invoice-input" accept="application/pdf,image/png,image/jpeg,image/webp" style={{ padding: 8 }}
            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
          <div id="restock-invoice-status" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{invoiceStatus}</div>
        </div>
        <div id="restock-form-error" style={{ display: error ? 'block' : 'none', fontSize: 12, color: 'var(--error)', fontWeight: 500 }}>{error}</div>
      </div>
    </DialogShell>
  );
}
