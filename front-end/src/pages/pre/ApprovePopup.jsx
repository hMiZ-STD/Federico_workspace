'use strict';

import { useState } from 'react';
import { api } from '../../api/index.js';
import { toast } from '../../components/feedback/feedback.js';
import { sortDoctorsForDepartment, to24Hour } from './preHelpers.js';
import DialogShell from '../../components/layout/DialogShell.jsx';
import { DoctorOptions } from './PrePopup.jsx';

const UNAVAILABLE = 'Doctor is not available at this time. Please select another time slot.';

/**
 * Ported from openApprove / confirmApprove in PRE/js/requests.js.
 *
 * This is where PRE allocates the on-duty doctor for an incoming request.
 * Availability (the doctor's calendar, the Mon–Fri 09:00–17:00 roster, and
 * double-booking) is decided by the backend when the approval is submitted;
 * a 409 from it is shown inline under the time picker. The popup used to
 * re-implement that check client-side from two extra fetches, and the two
 * copies had drifted apart.
 */
export default function ApprovePopup({ request, doctors, onClose, onDone }) {
  const [doctorId, setDoctorId] = useState(request?.doctor_id ? String(request.doctor_id) : '');

  // Parse the existing requested_time into its components so we can pre-fill
  // the three separate controls (hour, minute, meridiem).
  function parseInitialTime(rawTime) {
    const t24 = to24Hour(rawTime); // normalise to HH:MM
    if (!t24) return { hour: '', minute: '00', meridiem: 'AM' };
    const [h, m] = t24.split(':');
    const hourNum = parseInt(h, 10);
    if (Number.isNaN(hourNum)) return { hour: '', minute: m || '00', meridiem: 'AM' };
    const meridiem = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 || 12;
    return { hour: String(hour12), minute: m || '00', meridiem };
  }

  const init = parseInitialTime(request?.requested_time);
  const [hour, setHour] = useState(init.hour);
  const [minute, setMinute] = useState(init.minute);
  const [meridiem, setMeridiem] = useState(init.meridiem);

  // Availability error shown inline beneath the time picker.
  const [availError, setAvailError] = useState('');
  // Prevents double-click while the approval is in flight.
  const [checking, setChecking] = useState(false);

  if (!request) return null;

  async function confirm() {
    if (!doctorId) {
      toast('Select a doctor', 'error');
      return;
    }
    // An empty hour keeps the patient's requested time; with neither, there
    // is no slot to book.
    if (!request.requested_date || (!hour && !to24Hour(request.requested_time))) {
      setAvailError(UNAVAILABLE);
      return;
    }

    setAvailError('');
    const payload = { status: 'APPROVED', doctor_id: Number(doctorId) };
    if (hour) {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      payload.requested_time = `${hh}:${mm} ${meridiem}`;
    }

    setChecking(true);
    try {
      await api.preRequests.update(request.pre_request_id, payload);
    } catch (err) {
      // 409 = the doctor is off duty or already booked for this slot.
      if (err.status === 409) setAvailError(err.message || UNAVAILABLE);
      else toast(err.message || 'Could not approve this request', 'error');
      return;
    } finally {
      setChecking(false);
    }

    onClose();
    toast('Approved', 'success');
    await onDone();
  }

  // Clear the availability error whenever the doctor or time selection changes
  // so the user gets fresh feedback after adjusting.
  function handleDoctorChange(e) {
    setDoctorId(e.target.value);
    setAvailError('');
  }
  function handleHourChange(e) {
    setHour(e.target.value);
    setAvailError('');
  }
  function handleMinuteChange(e) {
    setMinute(e.target.value);
    setAvailError('');
  }
  function handleMeridiemChange(e) {
    setMeridiem(e.target.value);
    setAvailError('');
  }

  // Hour options 1–12
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  // Minute options 00, 05, 10 … 55
  const minuteOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const inputStyle = {
    border: '1px solid var(--border, #d1d5db)',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 14,
    background: 'var(--surface, #fff)',
    color: 'var(--text-primary, #111)',
    cursor: 'pointer',
  };

  return (
    <DialogShell
      open
      onClose={onClose}
      size="md"
      title="Approve Appointment"
      subtitle="Assign a doctor. Leave time empty to keep the patient's requested slot."
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, width: '100%' }}>
          <button className="btn btn-secondary btn-default" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-default" onClick={confirm} disabled={checking}>
            {checking ? 'Checking…' : 'Submit'}
          </button>
        </div>
      }
    >
      <div className="popup-form-layout" style={{ margin: 0 }}>
        <div className="popup-summary-row">
          <span className="popup-summary-pill">{request.patientName || 'Patient'}</span>
          <span className="popup-summary-pill">{request.department || 'General'}</span>
        </div>
        <div className="form-group">
          <label htmlFor="doctorSelect">Doctor</label>
          <select id="doctorSelect" className="custom-select popup-input" value={doctorId} onChange={handleDoctorChange}>
            <DoctorOptions doctors={doctors} department={request.department} sortFn={sortDoctorsForDepartment} />
          </select>
        </div>
        <div className="form-group">
          <label>Appointment Time</label>
          {/* AM/PM time picker: three separate selects so the user can
              explicitly choose hour, minute and meridiem without the
              browser's native time widget hiding AM/PM on some systems. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Hour */}
            <select value={hour} onChange={handleHourChange} style={inputStyle} aria-label="Hour">
              <option value="">HH</option>
              {hourOptions.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
              ))}
            </select>

            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-secondary)' }}>:</span>

            {/* Minute */}
            <select value={minute} onChange={handleMinuteChange} style={inputStyle} aria-label="Minute">
              {minuteOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* AM / PM */}
            <select value={meridiem} onChange={handleMeridiemChange} style={{ ...inputStyle, fontWeight: 600 }} aria-label="AM or PM">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
          <small className="popup-helper">Optional. Leave hour blank to keep the requested time.</small>

          {/* Availability error — shown only when the doctor is unavailable */}
          {availError && (
            <div style={{
              marginTop: 8,
              padding: '8px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              color: '#991b1b',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {availError}
            </div>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
