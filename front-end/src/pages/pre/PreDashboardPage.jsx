'use strict';

import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { loadIntakeData, pendingBedRequestIds, awaitingCheckIn } from './intakeData.js';
import TriageQueue from './TriageQueue.jsx';

/**
 * Ported from PRE/pages/PRE.html + PRE.js.
 *
 * The four counters link into the Intake Hub tabs, and the check-in queue is
 * the same component as the hub's Triage tab: each scheduled patient gets the
 * two triage decisions, Check In for OPD or Admit to Ward (IPD).
 */
export default function PreDashboardPage() {
  useDocumentTitle('Dashboard');

  const { data, reload } = useApi(loadIntakeData, []);
  const rows = data?.rows || [];

  const counters = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
    admitted: rows.filter((r) => r.status === 'ADMITTED').length,
    discharge: rows.filter((r) => r.status === 'DISCHARGE_APPROVED' || r.status === 'DISCHARGE_REQUESTED').length,
  };

  const card = (to, title, value) => (
    <Link to={to} className="card">
      <h3>{title}</h3>
      <p>{value}</p>
    </Link>
  );

  return (
    <>
      <div className="cards">
        {card('/PRE/pages/request.html', 'Pending Requests', counters.pending + ' Requests')}
        {card('/PRE/pages/rejected.html', 'Rejected Requests', counters.rejected + ' Requests')}
        {card('/PRE/pages/admitted.html', 'Admitted Patients', counters.admitted + ' Patients')}
        {card('/PRE/pages/discharge.html', 'Discharge Approvals', counters.discharge + ' In Queue')}
      </div>

      <TriageQueue
        rows={awaitingCheckIn(rows)}
        pendingBedRequestIds={pendingBedRequestIds(data?.bedRequests)}
        onChanged={reload}
      />
    </>
  );
}
