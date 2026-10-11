'use strict';

const dataStore = require('../store/dataStore');
const { maxId } = require('../utils/maxId');
const activityService = require('./activity.service');
const wardService = require('./ward.service');

/**
 * Explicit state machine for the PRE intake → admission → discharge
 * lifecycle, replacing the original frontend's ad-hoc `status` +
 * `patientStatus` pair (two overlapping, independently-writable fields —
 * a repeated source of the "state gets out of sync" bugs found in the
 * pre-migration audit). One status field, one table of who may move it
 * where. See TRANSITIONS below for the actual workflow this encodes.
 */
const STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CONSULTATION_DONE',
  'EMERGENCY',
  'ADMITTED',
  'DISCHARGE_REQUESTED',
  'DISCHARGE_APPROVED',
  'DISCHARGED',
];

// fromStatus -> { toStatus: [actors allowed to make this specific move] }
// Actors not listed for a transition can never make it, regardless of
// their general 'preRequest' write access — this is deliberately more
// precise than a coarse read/write gate (see actorAccess.js's comment on
// this resource for why that distinction matters).
const TRANSITIONS = {
  PENDING: {
    APPROVED: ['PRE'],
    REJECTED: ['PRE', 'Patient'], // Patient may only cancel their OWN pending request (ownership enforced in the controller)
  },
  APPROVED: {
    EMERGENCY: ['PRE'],
    CONSULTATION_DONE: ['PRE'],
  },
  EMERGENCY: {
    ADMITTED: ['HOM'], // via bed allocation — see ward.service.js#updateBedRequest cascade
  },
  ADMITTED: {
    DISCHARGE_REQUESTED: ['PRE'],
  },
  DISCHARGE_REQUESTED: {
    DISCHARGE_APPROVED: ['HOM'],
  },
  DISCHARGE_APPROVED: {
    DISCHARGED: ['PRE'], // PRE's final sign-off — releases the bed, see below
  },
};

// APPROVED -> ADMITTED also happens via HOM bed allocation.
TRANSITIONS.APPROVED.ADMITTED = ['HOM'];

const HOM_STATUS_BY_STATUS = {
  PENDING: 'Awaiting PRE review',
  APPROVED: 'Awaiting PRE action / bed request',
  REJECTED: 'Closed — rejected by PRE',
  CONSULTATION_DONE: 'Closed — consultation complete',
  EMERGENCY: 'Awaiting HOM bed allocation',
  ADMITTED: 'Bed confirmed',
  DISCHARGE_REQUESTED: 'Awaiting HOM discharge coordination',
  DISCHARGE_APPROVED: 'Ready for PRE final sign-off',
  DISCHARGED: 'Closed — discharged',
};

function canTransition(fromStatus, toStatus, actorRole) {
  const allowedActors = TRANSITIONS[fromStatus]?.[toStatus];
  return Boolean(allowedActors && allowedActors.includes(actorRole));
}

function isTerminal(status) {
  return ['REJECTED', 'CONSULTATION_DONE', 'DISCHARGED'].includes(status);
}

function findAll(predicate = null) {
  return predicate ? dataStore.preRequests.filter(predicate) : dataStore.preRequests;
}

/**
 * The CONFIRMED appointment an approved request books with its doctor, so
 * the doctor's slot is visible to later double-booking checks.
 */
function createLinkedAppointment(request) {
  const timePart = request.requested_time
    ? (request.requested_time.includes(':') ? request.requested_time : '09:00:00')
    : '09:00:00';
  const newAppointment = {
    appointment_id:
      maxId(dataStore.appointments, 'appointment_id') + 1 || 601,
    patient_id: request.patient_id,
    doctor_id: request.doctor_id || null,
    appointment_date: request.requested_date,
    appointment_time: request.requested_time || null,
    scheduled_datetime: request.requested_date ? `${request.requested_date}T${timePart}` : null,
    department: request.department || 'General',
    status: 'CONFIRMED',
    organization_id: request.organization_id,
    hospital_id: request.hospital_id,
    created_at: new Date().toISOString(),
  };
  dataStore.appointments.push(newAppointment);
  request.appointment_id = newAppointment.appointment_id;
  return newAppointment;
}

function findOne(id) {
  return dataStore.preRequests.find((p) => p.pre_request_id === id) || null;
}

function create(payload, createdBy) {
  const initialStatus =
    payload.status || (payload.visit_type === 'Emergency' ? 'EMERGENCY' : 'PENDING');
  const newRequest = {
    pre_request_id:
      maxId(dataStore.preRequests, 'pre_request_id') + 1 || 1,
    patient_id: Number(payload.patient_id),
    appointment_id: payload.appointment_id ? Number(payload.appointment_id) : null,
    department: payload.department,
    doctor_id: payload.doctor_id ? Number(payload.doctor_id) : null,
    visit_type: payload.visit_type,
    ward_type: payload.ward_type || null,
    requested_date: payload.requested_date || payload.appointment_date || null,
    requested_time: payload.requested_time || payload.appointment_time || null,
    note: payload.note || null,
    document_urls: Array.isArray(payload.document_urls) ? payload.document_urls : [],
    status: initialStatus,
    hom_status: HOM_STATUS_BY_STATUS[initialStatus] || 'Awaiting PRE review',
    bed_id: null,
    reject_reason: null,
    created_by: createdBy || null,
    organization_id: payload.organization_id ? Number(payload.organization_id) : null,
    hospital_id: payload.hospital_id ? Number(payload.hospital_id) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    decided_at: null,
  };
  dataStore.preRequests.push(newRequest);

  // PRE's "Create Appointment" schedules straight into APPROVED with a doctor;
  // book that doctor's slot just as the PENDING -> APPROVED transition does.
  if (initialStatus === 'APPROVED' && newRequest.doctor_id && !newRequest.appointment_id) {
    createLinkedAppointment(newRequest);
  }

  const patient = dataStore.patients.find(
    (p) => p.patient_id === newRequest.patient_id,
  );
  activityService.log(
    'info',
    `Pre-registration submitted for ${patient ? patient.name : 'patient #' + newRequest.patient_id}`,
    { preRequestId: newRequest.pre_request_id },
    newRequest.organization_id,
  );

  return newRequest;
}

/**
 * Field-level update (doctor/date/time/department/ward_type/visit_type) —
 * PRE rescheduling or assigning a doctor. Does not change status. If a
 * linked appointment exists, its matching fields are synchronized too.
 */
function updateFields(id, patch) {
  const request = findOne(id);
  if (!request) return null;

  const allowedFields = ['doctor_id', 'requested_date', 'requested_time', 'department', 'ward_type', 'visit_type'];
  const updateData = {};
  for (const field of allowedFields) {
    if (patch[field] !== undefined) {
      updateData[field] = patch[field];
    }
  }
  Object.assign(request, updateData);
  request.updated_at = new Date().toISOString();

  // Synchronize with linked appointment if present
  if (request.appointment_id) {
    const appointment = dataStore.appointments.find(
      (a) => a.appointment_id === request.appointment_id,
    );
    if (appointment) {
      if (updateData.requested_date) {
        appointment.appointment_date = updateData.requested_date;
        const timePart = updateData.requested_time
          ? (updateData.requested_time.includes(':') ? updateData.requested_time : '09:00:00')
          : '09:00:00';
        appointment.scheduled_datetime = `${updateData.requested_date}T${timePart}`;
      }
      if (updateData.requested_time) appointment.appointment_time = updateData.requested_time;
      if (updateData.doctor_id) appointment.doctor_id = Number(updateData.doctor_id);
      if (updateData.department) appointment.department = updateData.department;
      if (updateData.visit_type) appointment.visit_type = updateData.visit_type;
    }
  }

  return request;
}

/**
 * Status transition. Caller (controller) has already verified `actorRole`
 * is allowed to make this specific fromStatus -> toStatus move.
 */
function transition(id, toStatus, actorRole, extra) {
  const request = findOne(id);
  if (!request) return null;

  request.status = toStatus;
  request.hom_status = HOM_STATUS_BY_STATUS[toStatus] || request.hom_status;
  request.updated_at = new Date().toISOString();
  if (
    isTerminal(toStatus) ||
    ['ADMITTED', 'DISCHARGE_APPROVED'].includes(toStatus)
  ) {
    request.decided_at = request.decided_at || new Date().toISOString();
  }

  if (toStatus === 'REJECTED' && extra?.reject_reason) {
    request.reject_reason = extra.reject_reason;
  }

  if (toStatus === 'ADMITTED' && extra?.bed_id) {
    request.bed_id = Number(extra.bed_id);
  }
  // Admission must leave the physical bed OCCUPIED. The bed-allocation path
  // already set it, but any other route into ADMITTED previously recorded the
  // bed_id without ever marking the bed itself.
  if (toStatus === 'ADMITTED' && request.bed_id) {
    wardService.updateBedStatus(request.bed_id, 'OCCUPIED');
  }

  if (extra?.doctor_id) request.doctor_id = Number(extra.doctor_id);
  if (extra?.requested_time) request.requested_time = extra.requested_time;
  if (extra?.requested_date) request.requested_date = extra.requested_date;
  if (extra?.department) request.department = extra.department;

  if (toStatus === 'DISCHARGED') {
    // Release the physical bed and finalize the inpatient admission.
    // We look up by patient_id only — relying on bed_id matching the pre-request
    // is fragile if the pre-request's bed_id was set in a separate transaction.
    if (request.bed_id) {
      wardService.updateBedStatus(request.bed_id, 'AVAILABLE');
    }
    const patientAdmissions = dataStore.admissions.filter(
      (a) => a.patient_id === request.patient_id,
    );
    // Pick the active admission (any non-DISCHARGED status)
    const admission = patientAdmissions.find((a) => a.status !== 'DISCHARGED');
    if (admission) {
      admission.status = 'DISCHARGED';
      admission.discharge_time = new Date().toISOString();
    }
  }

  // Synchronize appointment status if linked
  if (request.appointment_id) {
    const appointment = dataStore.appointments.find(
      (a) => a.appointment_id === request.appointment_id,
    );
    if (appointment) {
      if (toStatus === 'APPROVED') {
        appointment.status = 'CONFIRMED';
      } else if (toStatus === 'REJECTED') {
        appointment.status = 'CANCELLED';
      } else if (['CONSULTATION_DONE', 'DISCHARGED'].includes(toStatus)) {
        appointment.status = 'COMPLETED';
      }
    }
  } else if (toStatus === 'APPROVED') {
    createLinkedAppointment(request);
  }

  activityService.log(
    'success',
    `Pre-request #${id} moved to ${toStatus}`,
    { preRequestId: id, actorRole },
    request.organization_id,
  );

  return request;
}

const OPD_CONSULTATION_FEE = 500;
const CHECK_IN_STATUSES = ['PENDING', 'APPROVED', 'EMERGENCY'];

/**
 * The tenant's own consultation tariff for the OPD check-in charge. The
 * original searched every tenant's services, so one org's check-in could post
 * another org's service_id/price. Prefers the exact "Consultation Fee" row
 * every provisioned tenant is seeded with, then any consultation service, and
 * creates the standard ₹500 one if the tenant has none.
 */
function consultationServiceFor(organizationId, hospitalId) {
  const own = dataStore.services.filter(
    (s) => s.organization_id === organizationId && s.service_name,
  );
  const found =
    own.find((s) => s.service_name.toLowerCase() === 'consultation fee') ||
    own.find((s) => s.service_name.toLowerCase().includes('consult'));
  if (found) return found;

  const created = {
    service_id: maxId(dataStore.services, 'service_id') + 1 || 1,
    service_name: 'Consultation Fee',
    category: 'Consultation',
    base_cost: OPD_CONSULTATION_FEE,
    organization_id: organizationId || null,
    hospital_id: hospitalId || null,
  };
  dataStore.services.push(created);
  return created;
}

function checkIn(id, payload = {}, organizationId, hospitalId, actorRole = 'PRE') {
  const request = findOne(id);
  if (!request) {
    const err = new Error(`Pre-request #${id} not found`);
    err.statusCode = 404;
    throw err;
  }

  // Triage only applies to a patient still in the intake queue — never to
  // one already checked in, admitted, rejected or discharged.
  if (!CHECK_IN_STATUSES.includes(request.status)) {
    const err = new Error(
      `Pre-request #${id} is ${request.status} and can no longer be checked in`,
    );
    err.name = 'Conflict';
    err.statusCode = 409;
    throw err;
  }

  const visitType = payload.visit_type === 'Admit' ? 'Admit' : 'OPD';
  const orgId = organizationId || request.organization_id;
  const hospId = hospitalId || request.hospital_id;

  // PRE may allocate the on-duty doctor at triage time.
  if (payload.doctor_id) request.doctor_id = Number(payload.doctor_id);

  if (visitType === 'OPD') {
    request.status = 'CONSULTATION_DONE';
    request.visit_type = 'OPD';
    request.updated_at = new Date().toISOString();

    // Every OPD visit is its own outpatient encounter with its own ledger and
    // consultation fee. (This used to reuse ANY active admission the patient
    // had - so a second visit while an earlier bill was unsettled posted no
    // fee, and an inpatient stay was relabelled as OPD.)
    let admission = request.admission_id
      ? dataStore.admissions.find((a) => a.admission_id === request.admission_id)
      : null;

    if (!admission) {
      admission = {
        admission_id:
          maxId(dataStore.admissions, 'admission_id') + 1 || 501,
        patient_id: request.patient_id,
        doctor_id: request.doctor_id || null,
        department: request.department || 'General',
        visit_type: 'OPD',
        admission_date: new Date().toISOString(),
        status: 'ADMITTED',
        organization_id: orgId,
        hospital_id: hospId,
        created_at: new Date().toISOString(),
      };
      dataStore.admissions.push(admission);
    }
    request.admission_id = admission.admission_id;

    // Check if a ledger already exists for this admission or patient
    let ledger = dataStore.ledgers.find((l) => l.admission_id === admission.admission_id);
    if (!ledger) {
      ledger = {
        ledger_id:
          maxId(dataStore.ledgers, 'ledger_id') + 1 || 801,
        admission_id: admission.admission_id,
        status: 'OPEN',
        organization_id: orgId,
        hospital_id: hospId,
        created_at: new Date().toISOString(),
      };
      dataStore.ledgers.push(ledger);

      const service = consultationServiceFor(orgId, hospId);
      const serviceId = service.service_id;
      const unitPrice = Number(service.base_cost) || OPD_CONSULTATION_FEE;

      const entry = {
        entry_id:
          maxId(dataStore.ledgerEntries, 'entry_id') + 1 || 901,
        ledger_id: ledger.ledger_id,
        service_id: serviceId,
        quantity: 1,
        unit_price: unitPrice,
        amount: unitPrice,
        organization_id: orgId,
        hospital_id: hospId,
        created_at: new Date().toISOString(),
      };
      dataStore.ledgerEntries.push(entry);
    }

    // Synchronize appointment status
    if (request.appointment_id) {
      const appt = dataStore.appointments.find((a) => a.appointment_id === request.appointment_id);
      if (appt) appt.status = 'COMPLETED';
    }

    activityService.log(
      'success',
      `Outpatient checked in: Pre-request #${id}, Ledger #${ledger.ledger_id} active`,
      { preRequestId: id, admissionId: admission.admission_id, ledgerId: ledger.ledger_id },
      orgId,
    );

    return { preRequest: request, admission, ledger };
  } else {
    // Inpatient Admit flow: marks visit_type = 'Admit', status = 'APPROVED'
    // and queues a bed request for HOM. The inpatient admission itself is
    // created when HOM allocates the bed (ward.controller.js), so no existing
    // admission is touched here - this used to relabel whatever active
    // admission the patient had (e.g. an unpaid OPD visit) as 'Admit'.
    request.visit_type = 'Admit';
    request.status = 'APPROVED';
    request.updated_at = new Date().toISOString();

    let bedRequest = dataStore.bedRequests.find(
      (b) => b.pre_request_id === request.pre_request_id && (b.status === 'PENDING' || b.status === 'ALLOCATED'),
    );
    if (!bedRequest) {
      bedRequest = {
        bed_request_id:
          maxId(dataStore.bedRequests, 'bed_request_id') + 1 || 1,
        pre_request_id: request.pre_request_id,
        patient_id: Number(request.patient_id),
        ward_id: null,
        priority: payload.priority || 'NORMAL',
        status: 'PENDING',
        bed_id: null,
        requested_by: actorRole || 'PRE',
        organization_id: orgId,
        hospital_id: hospId,
        requested_at: new Date().toISOString(),
        decided_at: null,
      };
      dataStore.bedRequests.push(bedRequest);
    } else if (payload.priority && bedRequest.status === 'PENDING') {
      bedRequest.priority = payload.priority;
    }

    activityService.log(
      'info',
      `Pre-request #${id} marked for Inpatient Admission (Bed request #${bedRequest.bed_request_id} sent to HOM)`,
      { preRequestId: id, bedRequestId: bedRequest.bed_request_id },
      orgId,
    );

    return { preRequest: request, bedRequest };
  }
}

module.exports = {
  STATUSES,
  TRANSITIONS,
  canTransition,
  isTerminal,
  findAll,
  findOne,
  create,
  updateFields,
  transition,
  checkIn,
};
