'use strict';

import { useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';
import DialogShell from '../../components/layout/DialogShell.jsx';

/** Ported from reject / confirmReject in PRE/js/requests.js. */
export default function RejectPopup({ request, onClose, onDone }) {
  const [reason, setReason] = useState('');

  if (!request) return null;

  async function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast('Enter reason', 'error');
      return;
    }
    try {
      await api.preRequests.update(request.pre_request_id, { status: 'REJECTED', reject_reason: trimmed });
      onClose();
      toast('Rejected successfully', 'success');
      await onDone();
    } catch (err) {
      toast(err.message || 'Could not reject this request', 'error');
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      size="sm"
      title="Reject Request"
      subtitle="Add a clear reason so the patient sees why."
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, width: '100%' }}>
          <button className="btn btn-secondary btn-default" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger btn-default" onClick={confirm}>Submit</button>
        </div>
      }
    >
      <div className="popup-form-layout" style={{ margin: 0 }}>
        <div className="form-group">
          <label htmlFor="rejectReason">Reason</label>
          <textarea id="rejectReason" className="popup-textarea" placeholder="Enter reason..." rows="4"
            value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
    </DialogShell>
  );
}

