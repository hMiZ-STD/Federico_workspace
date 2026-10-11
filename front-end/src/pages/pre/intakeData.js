'use strict';

import { api } from '../../api/index.js';
import { joinPreRequestsWithPatients } from './preHelpers.js';

const arr = (v) => (Array.isArray(v) ? v : []);
const indexBy = (list, key) => {
  const out = {};
  list.forEach((item) => (out[item[key]] = item));
  return out;
};

/**
 * One load for every PRE intake view. The five pages the Intake Hub replaced
 * (requests, rejected, admitted, discharge, HOM coordination) each fetched
 * their own overlapping subset of these endpoints; this fetches them once.
 *
 * Each row is a pre-request joined to its patient and doctor, plus:
 *  - bedNumber    the ward bed it holds ('-' when none)
 *  - billsCleared Finance has settled (or cleared) the patient's ledger
 */
export async function loadIntakeData() {
  const [preRequests, patients, doctors, wards, beds, bedRequests, admissions, ledgers] =
    await Promise.all([
      api.preRequests.list().catch(() => []),
      api.patients.list().catch(() => []),
      api.doctors.list().catch(() => []),
      api.wards.list().catch(() => []),
      api.wards.beds().catch(() => []),
      api.wards.bedRequests.list().catch(() => []),
      api.admissions.list().catch(() => []),
      api.billing.ledger.listAll().catch(() => []),
    ]);

  const doctorsById = indexBy(arr(doctors), 'doctor_id');
  const bedsById = indexBy(arr(beds), 'bed_id');
  const ledgerByAdmission = indexBy(arr(ledgers), 'admission_id');

  const isCleared = (a) => {
    const ledger = ledgerByAdmission[a.admission_id];
    return Boolean(a.bills_cleared || (ledger && ledger.status === 'PAID'));
  };
  const clearedByAdmission = {};
  const billsClearedByPatient = {};
  arr(admissions).forEach((a) => {
    clearedByAdmission[a.admission_id] = isCleared(a);
    if (clearedByAdmission[a.admission_id]) billsClearedByPatient[a.patient_id] = true;
  });

  // An OPD check-in records its own admission_id; use that admission's
  // ledger so an older settled stay doesn't mark a new visit as paid.
  // Inpatient requests carry no admission_id and fall back to the patient.
  const rows = joinPreRequestsWithPatients(arr(preRequests), arr(patients), doctorsById).map((r) => ({
    ...r,
    bedNumber: bedsById[r.bed_id]?.bed_number || '-',
    billsCleared:
      r.admission_id && r.admission_id in clearedByAdmission
        ? clearedByAdmission[r.admission_id]
        : Boolean(billsClearedByPatient[r.patient_id]),
  }));

  return {
    rows,
    doctors: arr(doctors),
    wards: arr(wards),
    bedRequests: arr(bedRequests),
    patientsById: indexBy(arr(patients), 'patient_id'),
    wardsById: indexBy(arr(wards), 'ward_id'),
    bedsById,
  };
}

/** Pre-request ids that already have a bed request waiting on HOM. */
export function pendingBedRequestIds(bedRequests) {
  return new Set(
    (bedRequests || [])
      .filter((r) => r.status === 'PENDING')
      .map((r) => r.pre_request_id)
      .filter(Boolean),
  );
}

/** Confirmed appointments and walk-ins waiting at reception to be triaged. */
export function awaitingCheckIn(rows) {
  return rows.filter((r) => r.status === 'APPROVED');
}

/** OPD visits checked in whose bill Finance has not settled yet. */
export function activeOutpatients(rows) {
  return rows.filter((r) => r.status === 'CONSULTATION_DONE' && !r.billsCleared);
}

/** OPD visits that are checked in and paid — the visit is over. */
export function completedOutpatients(rows) {
  return rows.filter((r) => r.status === 'CONSULTATION_DONE' && r.billsCleared);
}
