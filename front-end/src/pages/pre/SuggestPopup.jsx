'use strict';

import { useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';
import { sortDoctorsForDepartment, to12Hour, to24Hour } from './preHelpers.js';
import DialogShell from '../../components/layout/DialogShell.jsx';
import { DoctorOptions } from './PrePopup.jsx';

/**
 * Ported from openSuggest / confirmSuggest in PRE/js/requests.js.
 *
 * Note the two sequential PUTs: the field update first, then a separate status
 * transition to APPROVED when the request was still PENDING. Combining them
 * would change what the backend sees, since a body carrying `status` takes the
 * transition path rather than the field-update path.
 */
export default function SuggestPopup({ request, doctors, onClose, onDone }) {
  const [doctorId, setDoctorId] = useState(request?.doctor_id ? String(request.doctor_id) : '');
  const [newDate, setNewDate] = useState(request?.requested_date || '');
  const [time, setTime] = useState(to24Hour(request?.requested_time));

  if (!request) return null;

  async function confirm() {
    if (!newDate || !doctorId) {
      toast('Fill all required fields', 'error');
      return;
    }
    try {
      const fieldPatch = { requested_date: newDate, doctor_id: Number(doctorId) };
      if (time) fieldPatch.requested_time = to12Hour(time);
      await api.preRequests.update(request.pre_request_id, fieldPatch);
      if (request.status === 'PENDING') {
        await api.preRequests.update(request.pre_request_id, { status: 'APPROVED' });
      }
      onClose();
      toast('Rescheduled successfully', 'success');
      await onDone();
    } catch (err) {
      toast(err.message || 'Could not reschedule this request', 'error');
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      size="md"
      title="Suggest New Slot"
      subtitle={`${request.patientName || 'Patient'} • Current: ${to12Hour(request.requested_time) || 'Not set'}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, width: '100%' }}>
          <button className="btn btn-secondary btn-default" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-default" onClick={confirm}>Save</button>
        </div>
      }
    >
      <div className="popup-form-layout" style={{ margin: 0 }}>
        <div className="form-group">
          <label htmlFor="doctorSelect">Doctor</label>
          <select id="doctorSelect" className="custom-select popup-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <DoctorOptions doctors={doctors} department={request.department} sortFn={sortDoctorsForDepartment} />
          </select>
        </div>
        <div className="popup-grid-two">
          <div className="form-group">
            <label htmlFor="newDate">New Date</label>
            <input type="date" id="newDate" className="popup-input" value={newDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="appointTime">New Time</label>
            <input type="time" id="appointTime" className="popup-input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

