'use strict';

import { api } from '../../api/index.js';
import { toast, selectOne } from '../../components/feedback/feedback.js';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { formatDate, to12Hour } from './preHelpers.js';

const PRIORITY_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
];

/**
 * The check-in queue: confirmed appointments and walk-ins waiting at
 * reception. Each row has the two triage decisions -
 *
 *  [Check In for OPD]      admission + open ledger with the consultation
 *                          fee; the patient goes to the doctor's cabin and
 *                          HOM is never involved.
 *  [Admit to Ward (IPD)]   asks Normal / Urgent, then sends a PENDING bed
 *                          request to HOM, who allocates the bed.
 *
 * Shown on the PRE dashboard and in the Intake Hub's Triage tab.
 */
export default function TriageQueue({ rows, pendingBedRequestIds, onChanged, title = 'Approved Patients' }) {
  async function checkInOpd(r) {
    try {
      await api.preRequests.checkIn(r.pre_request_id, { visit_type: 'OPD' });
      toast(
        r.patientName + ' checked in for OPD. Consultation fee posted - please send the patient to ' +
          (r.doctorName && r.doctorName !== '—' ? r.doctorName : 'the doctor') + '.',
        'success',
      );
    } catch (err) {
      toast(err.message || 'Could not check in this patient', 'error');
    }
    await onChanged();
  }

  async function admitToWard(r) {
    const priority = await selectOne({
      title: 'Admit ' + r.patientName + ' to ward',
      body: 'Choose the triage priority for the bed request sent to HOM.',
      options: PRIORITY_OPTIONS,
    });
    if (!priority) return;
    try {
      await api.preRequests.checkIn(r.pre_request_id, { visit_type: 'Admit', priority });
      toast('Bed request sent to HOM (' + priority.toLowerCase() + ' priority). Status: Pending.', 'success');
    } catch (err) {
      toast(err.message || 'Could not send the bed request', 'error');
    }
    await onChanged();
  }

  return (
    <div className="table-container">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th>
            <th>Doctor</th><th>Appointment Date</th><th>Appointment Time</th><th>Status</th><th>Action</th>
          </tr>
        </thead>
        <tbody id="approvedTable">
          {rows.length === 0 ? (
            <EmptyState asTableRow colSpan={10} title="No Scheduled Patients Awaiting Check-in" />
          ) : (
            rows.map((r) => {
              const hasPendingBedRequest = pendingBedRequestIds.has(r.pre_request_id);
              return (
                <tr key={r.pre_request_id}>
                  <td><strong>{r.patientUhid}</strong></td>
                  <td>{r.patientName}</td>
                  <td>{r.patientAge}</td>
                  <td>{r.patientGender}</td>
                  <td>{r.department}</td>
                  <td>{r.doctorName}</td>
                  <td>{formatDate(r.requested_date)}</td>
                  <td>{to12Hour(r.requested_time) || '-'}</td>
                  <td>
                    {hasPendingBedRequest ? (
                      <span className="badge badge-info">Pending Bed Request</span>
                    ) : (
                      <span className="badge badge-neutral">Scheduled</span>
                    )}
                  </td>
                  <td>
                    {hasPendingBedRequest ? (
                      <span style={{ color: 'var(--color-muted-fg)', fontSize: 12 }}>Awaiting HOM</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn suggest" type="button" onClick={() => checkInOpd(r)}>
                          Check In for OPD
                        </button>
                        <button className="btn approve" type="button" onClick={() => admitToWard(r)}>
                          Admit to Ward (IPD)
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
