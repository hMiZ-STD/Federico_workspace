'use strict';

import StatCard from '../../components/ui/StatCard.jsx';
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

  return (
    <>
      <div className="cards">
        <StatCard
          to="/PRE/pages/request.html"
          label="Pending Requests"
          value={counters.pending}
          sub="Requests awaiting triage"
          variant="warning"
        />
        <StatCard
          to="/PRE/pages/rejected.html"
          label="Rejected Requests"
          value={counters.rejected}
          sub="Requests declined"
          variant="error"
        />
        <StatCard
          to="/PRE/pages/admitted.html"
          label="Admitted Patients"
          value={counters.admitted}
          sub="Current inpatients"
          variant="success"
        />
        <StatCard
          to="/PRE/pages/discharge.html"
          label="Discharge Approvals"
          value={counters.discharge}
          sub="In discharge queue"
          variant="info"
        />
      </div>

      <TriageQueue
        rows={awaitingCheckIn(rows)}
        pendingBedRequestIds={pendingBedRequestIds(data?.bedRequests)}
        onChanged={reload}
      />
    </>
  );
}
