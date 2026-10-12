'use strict';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/index.js';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { toast } from '../../components/feedback/feedback.js';
import { statusLabel, formatDate, to12Hour } from './preHelpers.js';
import {
  loadIntakeData,
  pendingBedRequestIds,
  awaitingCheckIn,
  activeOutpatients,
  completedOutpatients,
} from './intakeData.js';
import TabNav from '../../components/ui/TabNav.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import TriageQueue from './TriageQueue.jsx';
import ApprovePopup from './ApprovePopup.jsx';
import SuggestPopup from './SuggestPopup.jsx';
import RejectPopup from './RejectPopup.jsx';

/**
 * The PRE Intake Hub: one page, three operational tabs, replacing the five
 * near-identical pages (request, rejected, admitted, discharge, HOM
 * coordination) that each repeated the same header/table and refetched the
 * same data. Every legacy URL still resolves, to the tab its content now
 * lives in (see routes.jsx), and the tables keep their original markup.
 *
 *  Triage      incoming requests (approve with doctor allocation / suggest /
 *              reject) and the check-in queue (OPD check-in or IPD admission)
 *  In-Hospital outpatients with the doctor, admitted inpatients, HOM bed queue
 *  Completed   discharge sign-off, finished OPD visits, discharges, rejections
 */
const INTAKE_TABS = [
  { id: 'triage', label: 'Triage & Incoming Queue', href: '/PRE/pages/request.html', title: 'Patient Requests' },
  { id: 'tracking', label: 'In-Hospital Tracking', href: '/PRE/pages/admitted.html', title: 'Admitted Patients' },
  { id: 'completed', label: 'Completed & Discharges', href: '/PRE/pages/discharge.html', title: 'Discharge Requests' },
];

export default function IntakeHubPage({ tab = 'triage' }) {
  const active = INTAKE_TABS.find((t) => t.id === tab) || INTAKE_TABS[0];
  useDocumentTitle(active.title);
  const navigate = useNavigate();

  const { data, reload } = useApi(loadIntakeData, []);
  const d = data || { rows: [], doctors: [], bedRequests: [], patientsById: {}, wardsById: {}, bedsById: {} };

  return (
    <>
      <TabNav
        tabs={INTAKE_TABS}
        activeTab={active.id}
        onChange={(tabId) => {
          const target = INTAKE_TABS.find((t) => t.id === tabId);
          if (target) navigate(target.href);
        }}
        variant="underline"
        style={{ margin: '20px 20px 0' }}
      />

      {active.id === 'triage' ? <TriageTab d={d} reload={reload} /> : null}
      {active.id === 'tracking' ? <TrackingTab d={d} reload={reload} /> : null}
      {active.id === 'completed' ? <CompletedTab d={d} reload={reload} /> : null}
    </>
  );
}

// ---------------------------------------------------------------- Triage --

function TriageTab({ d, reload }) {
  const [popup, setPopup] = useState(null); // { kind, id }
  const pending = d.rows.filter((r) => r.status === 'PENDING');
  const activeRequest = popup ? pending.find((r) => r.pre_request_id === popup.id) : null;

  return (
    <>
      <div className="container">
        <h2>Patient Requests</h2>
        <table>
          <thead>
            <tr>
              <th>Patient ID</th><th>Age</th><th>Gender</th><th>Name</th><th>Department</th>
              <th>Doctor</th><th>Appointment Date</th><th>Booked Date</th><th>Appointment Time</th>
              <th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody id="requestTable">
            {pending.length === 0 ? (
              <EmptyState asTableRow colSpan={11} title="No Pending Requests" />
            ) : (
              pending.map((r) => (
                <tr key={r.pre_request_id}>
                  <td>{r.patientUhid}</td>
                  <td>{r.patientAge}</td>
                  <td>{r.patientGender}</td>
                  <td>{r.patientName}</td>
                  <td>{r.department}</td>
                  <td>{r.doctorName}</td>
                  <td>{formatDate(r.requested_date)}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>{to12Hour(r.requested_time) || '-'}</td>
                  <td>{statusLabel(r.status)}</td>
                  <td>
                    <button className="btn approve" onClick={() => setPopup({ kind: 'approve', id: r.pre_request_id })}>Approve</button>
                    <button className="btn suggest" onClick={() => setPopup({ kind: 'suggest', id: r.pre_request_id })}>Suggest</button>
                    <button className="btn reject" onClick={() => setPopup({ kind: 'reject', id: r.pre_request_id })}>Reject</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TriageQueue
        title="Awaiting Check-in"
        rows={awaitingCheckIn(d.rows)}
        pendingBedRequestIds={pendingBedRequestIds(d.bedRequests)}
        onChanged={reload}
      />

      {popup?.kind === 'approve' ? (
        <ApprovePopup request={activeRequest} doctors={d.doctors} onClose={() => setPopup(null)} onDone={reload} />
      ) : null}
      {popup?.kind === 'suggest' ? (
        <SuggestPopup request={activeRequest} doctors={d.doctors} onClose={() => setPopup(null)} onDone={reload} />
      ) : null}
      {popup?.kind === 'reject' ? (
        <RejectPopup request={activeRequest} onClose={() => setPopup(null)} onDone={reload} />
      ) : null}
    </>
  );
}

// -------------------------------------------------------------- Tracking --

function TrackingTab({ d, reload }) {
  const outpatients = activeOutpatients(d.rows);
  const admitted = d.rows.filter((r) => r.status === 'ADMITTED');

  async function requestDischarge(id) {
    try {
      await api.preRequests.update(id, { status: 'DISCHARGE_REQUESTED' });
      toast('Discharge request sent to HOM', 'success');
      await reload();
    } catch (err) {
      toast(err.message || 'Could not request discharge', 'error');
    }
  }

  return (
    <>
      <div className="container">
        <h2>Outpatients with Doctor</h2>
        <table>
          <thead>
            <tr>
              <th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th>
              <th>Doctor</th><th>Appointment Date</th><th>Appointment Time</th><th>Status</th><th>Billing</th>
            </tr>
          </thead>
          <tbody id="outpatientTable">
            {outpatients.length === 0 ? (
              <EmptyState asTableRow colSpan={10} title="No Outpatients Currently Consulting" />
            ) : (
              outpatients.map((r) => (
                <tr key={r.pre_request_id}>
                  <td>{r.patientUhid}</td>
                  <td>{r.patientName}</td>
                  <td>{r.patientAge}</td>
                  <td>{r.patientGender}</td>
                  <td>{r.department}</td>
                  <td>{r.doctorName}</td>
                  <td>{formatDate(r.requested_date)}</td>
                  <td>{to12Hour(r.requested_time) || '-'}</td>
                  <td>OPD Consultation</td>
                  <td style={{ color: '#b45309' }}>Awaiting Finance payment</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="container">
        <h2>Admitted Patient Records</h2>
        <table>
          <thead>
            <tr>
              <th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th>
              <th>Doctor</th><th>Appointment Date</th><th>Appointment Time</th><th>Status</th><th>Bed No</th><th>Action</th>
            </tr>
          </thead>
          <tbody id="admittedTable">
            {admitted.length === 0 ? (
              <EmptyState asTableRow colSpan={11} title="No Admitted Patients Found" />
            ) : (
              admitted.map((r) => (
                <tr key={r.pre_request_id}>
                  <td>{r.patientUhid}</td>
                  <td>{r.patientName}</td>
                  <td>{r.patientAge}</td>
                  <td>{r.patientGender}</td>
                  <td>{r.department}</td>
                  <td>{r.doctorName}</td>
                  <td>{formatDate(r.requested_date)}</td>
                  <td>{to12Hour(r.requested_time) || '-'}</td>
                  <td>Admitted</td>
                  <td>{r.bedNumber}</td>
                  <td>
                    <button className="btn reject" onClick={() => requestDischarge(r.pre_request_id)}>
                      Discharge request
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BedAllocationQueue d={d} />
    </>
  );
}

const pill = (bg, border, color, weight, text) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, border: '1px solid ' + border, background: bg, fontSize: 11, fontWeight: weight, color }}>{text}</span>
);

function priorityBadge(priority) {
  if (priority === 'CRITICAL') return pill('#fef2f2', '#fecaca', '#991b1b', 700, 'Critical');
  if (priority === 'URGENT') return pill('#fef2f2', '#fecaca', '#991b1b', 700, 'Urgent');
  if (priority === 'HIGH') return pill('#fef3c7', '#fde68a', '#b45309', 700, 'High');
  return pill('#f8fafc', '#e2e8f0', '#475569', 600, 'Normal');
}

/** Read-only view of HOM's bed allocation decisions (was HomCoordinationPage). */
function BedAllocationQueue({ d }) {
  // Show PENDING + ALLOCATED + DENIED so PRE can see the full HOM response.
  const requests = d.bedRequests.filter((r) =>
    r.status === 'PENDING' || r.status === 'ALLOCATED' || r.status === 'DENIED',
  );

  return (
    <div className="container" style={{ margin: '24px 20px' }}>
      <div className="directory-header">
        <div className="directory-title-group">
          <h2>Hospital Operations Management (HOM) Coordination</h2>
          <p>Monitor bed allocation requests submitted from PRE. Discharge approvals are managed in the Completed &amp; Discharges tab.</p>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Inpatient Bed Allocation Queue</h3>
          <span style={{ fontSize: 12, color: 'var(--color-muted-fg)' }}>Bed assignment is handled in HOM</span>
        </div>
        <div className="table-container" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Patient UHID</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Patient Name</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Requested Ward</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Priority</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Bed</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Status</th>
              </tr>
            </thead>
            <tbody id="homRequestTable">
              {requests.length === 0 ? (
                <EmptyState asTableRow colSpan={6} title="No bed allocation requests" />
              ) : (
                requests.map((r) => {
                  const patient = d.patientsById[r.patient_id] || {};
                  const wardName = r.ward_id ? d.wardsById[r.ward_id]?.ward_name || 'Ward Requested' : 'HOM Decides';

                  let bedCell = <span style={{ color: 'var(--color-muted-fg)', fontSize: 12 }}>—</span>;
                  if (r.status === 'ALLOCATED' && r.bed_id && d.bedsById[r.bed_id]) {
                    bedCell = <strong style={{ color: 'var(--md-primary, #0f766e)' }}>{d.bedsById[r.bed_id].bed_number}</strong>;
                  } else if (r.status === 'DENIED') {
                    bedCell = <span style={{ color: '#6b7280', fontStyle: 'italic' }}>N/A</span>;
                  }

                  let statusBadge;
                  if (r.status === 'ALLOCATED') {
                    statusBadge = <span className="status confirmed" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontSize: 11, padding: '3px 8px', borderRadius: 12 }}>Allocated</span>;
                  } else if (r.status === 'DENIED') {
                    statusBadge = <span className="status rejected" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 11, padding: '3px 8px', borderRadius: 12 }}>Rejected</span>;
                  } else {
                    statusBadge = <span className="status pending" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: 11, padding: '3px 8px', borderRadius: 12 }}>Pending</span>;
                  }

                  return (
                    <tr key={r.bed_request_id}>
                      <td style={{ textAlign: 'left', padding: '12px 16px' }}>
                        <strong style={{ color: 'var(--md-primary, #0f766e)' }}>{patient.uhid || 'UHID-' + r.patient_id}</strong>
                      </td>
                      <td style={{ textAlign: 'left', padding: '12px 16px' }}><strong>{patient.name || '-'}</strong></td>
                      <td style={{ textAlign: 'left', padding: '12px 16px' }}>{wardName}</td>
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>{priorityBadge(r.priority)}</td>
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>{bedCell}</td>
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>{statusBadge}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Completed --

function CompletedTab({ d, reload }) {
  const dischargeRequested = d.rows.filter((r) => r.status === 'DISCHARGE_REQUESTED');
  const dischargeApproved = d.rows.filter((r) => r.status === 'DISCHARGE_APPROVED');
  const completed = [
    ...completedOutpatients(d.rows),
    ...d.rows.filter((r) => r.status === 'DISCHARGED'),
  ].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const rejected = d.rows.filter((r) => r.status === 'REJECTED');

  async function finalApprove(id) {
    try {
      await api.preRequests.update(id, { status: 'DISCHARGED' });
      toast('Discharge finalized — bed released.', 'success');
      await reload();
    } catch (err) {
      toast(err.message || 'Could not finalize discharge', 'error');
    }
  }

  const baseCells = (r) => (
    <>
      <td>{r.patientUhid}</td>
      <td>{r.patientName}</td>
      <td>{r.patientAge}</td>
      <td>{r.patientGender}</td>
      <td>{r.department}</td>
      <td>{r.doctorName}</td>
      <td>{formatDate(r.requested_date)}</td>
      <td>{to12Hour(r.requested_time) || '-'}</td>
      <td>{r.bedNumber}</td>
      <td>{r.status}</td>
    </>
  );

  return (
    <>
      <div className="container">
        <h2>Discharge request</h2>
        <table>
          <thead>
            <tr>
              <th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th>
              <th>Doctor</th><th>Appointment Date</th><th>Appointment Time</th><th>Bed No</th><th>Patient Status</th><th>HOM Status</th>
            </tr>
          </thead>
          <tbody id="dischargeTable">
            {dischargeRequested.length === 0 ? (
              <EmptyState asTableRow colSpan={11} title="No Pending Requests" />
            ) : (
              dischargeRequested.map((r) => (
                <tr key={r.pre_request_id}>
                  {baseCells(r)}
                  <td style={{ color: 'orange' }}>{r.hom_status || 'Awaiting HOM'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="container">
        <h3>{'✅'} Approved Discharge</h3>
        <table>
          <thead>
            <tr>
              <th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th>
              <th>Doctor</th><th>Appointment Date</th><th>Appointment Time</th><th>Bed No</th><th>Patient Status</th><th>Clearance</th><th>Action</th>
            </tr>
          </thead>
          <tbody id="approvedDischargeTable">
            {dischargeApproved.length === 0 ? (
              <EmptyState asTableRow colSpan={12} title="No Approved Requests" />
            ) : (
              dischargeApproved.map((r) => (
                <tr key={r.pre_request_id}>
                  {baseCells(r)}
                  {r.billsCleared ? (
                    <td style={{ color: 'green' }}>Bills cleared by Finance</td>
                  ) : (
                    <td style={{ color: '#b45309' }}>Awaiting Finance payment</td>
                  )}
                  <td>
                    {r.billsCleared ? (
                      <button className="btn approve" onClick={() => finalApprove(r.pre_request_id)}>
                        Discharge &amp; release bed
                      </button>
                    ) : (
                      <button className="btn approve" disabled title="Patient bill not cleared yet" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                        Discharge &amp; release bed
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="container">
        <h2>Completed Visits &amp; Discharges</h2>
        <table>
          <thead>
            <tr>
              <th>Patient ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Department</th>
              <th>Doctor</th><th>Appointment Date</th><th>Visit</th><th>Bed No</th><th>Status</th>
            </tr>
          </thead>
          <tbody id="completedTable">
            {completed.length === 0 ? (
              <EmptyState asTableRow colSpan={10} title="No Completed Visits" />
            ) : (
              completed.map((r) => (
                <tr key={r.pre_request_id}>
                  <td>{r.patientUhid}</td>
                  <td>{r.patientName}</td>
                  <td>{r.patientAge}</td>
                  <td>{r.patientGender}</td>
                  <td>{r.department}</td>
                  <td>{r.doctorName}</td>
                  <td>{formatDate(r.requested_date)}</td>
                  <td>{r.status === 'DISCHARGED' ? 'Inpatient' : 'Outpatient (OPD)'}</td>
                  <td>{r.bedNumber}</td>
                  <td>{statusLabel(r.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="container">
        <h2>Rejected Patient Requests</h2>
        <table>
          <thead>
            <tr>
              <th>Patient ID</th><th>Age</th><th>Gender</th><th>Name</th><th>Department</th>
              <th>Appointment Date</th><th>Booked Date</th><th>Rejection Reason</th><th>Status</th>
            </tr>
          </thead>
          <tbody id="rejectedTable">
            {rejected.length === 0 ? (
              <EmptyState asTableRow colSpan={9} title="No Rejected Requests" />
            ) : (
              rejected.map((r) => (
                <tr key={r.pre_request_id}>
                  <td>{r.patientUhid}</td>
                  <td>{r.patientAge}</td>
                  <td>{r.patientGender}</td>
                  <td>{r.patientName}</td>
                  <td>{r.department}</td>
                  <td>{formatDate(r.requested_date)}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>{r.reject_reason || '-'}</td>
                  <td>{statusLabel(r.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
