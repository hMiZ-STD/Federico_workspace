'use strict';

const dataStore = require('../store/dataStore');
const { maxId } = require('../utils/maxId');
const doctorService = require('./doctor.service');

/** The booked date + time, from explicit fields or scheduled_datetime. */
function appointmentSlot(appointment) {
  const scheduled = String(appointment.scheduled_datetime || '');
  return {
    date: appointment.appointment_date || scheduled.slice(0, 10),
    time: appointment.appointment_time || scheduled.slice(11, 16),
  };
}

function findAll(predicate = null) {
  return predicate ? dataStore.appointments.filter(predicate) : dataStore.appointments;
}

function findOne(id) {
  return dataStore.appointments.find((a) => a.appointment_id === id) || null;
}

function create(appointment) {
  const patientId = Number(appointment.patient_id);
  if (!patientId || !dataStore.patients.find((p) => p.patient_id === patientId)) {
    const err = new Error(`Patient #${appointment.patient_id} not found`);
    err.statusCode = 404;
    throw err;
  }

  if (appointment.doctor_id) {
    const doctorId = Number(appointment.doctor_id);
    if (!dataStore.doctors.find((d) => d.doctor_id === doctorId)) {
      const err = new Error(`Doctor #${appointment.doctor_id} not found`);
      err.statusCode = 404;
      throw err;
    }

    // One doctor, one patient per slot: refuse an overlapping booking.
    const { date, time } = appointmentSlot(appointment);
    if (doctorService.findConflictingAppointment(doctorId, date, time)) {
      const err = new Error(
        'Doctor already has an appointment at this time. Please select another time slot.',
      );
      err.name = 'Conflict';
      err.statusCode = 409;
      throw err;
    }
  }

  const newAppointment = {
    appointment_id:
      maxId(dataStore.appointments, 'appointment_id') + 1 || 601,
    created_at: new Date().toISOString(),
    patient_id: patientId,
    doctor_id: appointment.doctor_id ? Number(appointment.doctor_id) : null,
    appointment_date: appointment.appointment_date,
    appointment_time: appointment.appointment_time || null,
    scheduled_datetime: appointment.scheduled_datetime || (appointment.appointment_date ? `${appointment.appointment_date}T${appointment.appointment_time || '09:00:00'}` : null),
    department: appointment.department || 'General',
    status: appointment.status || 'SCHEDULED',
    organization_id: appointment.organization_id ? Number(appointment.organization_id) : null,
    hospital_id: appointment.hospital_id ? Number(appointment.hospital_id) : null,
  };
  dataStore.appointments.push(newAppointment);
  return newAppointment;
}

function update(id, patch) {
  const appointment = findOne(id);
  if (!appointment) return null;
  Object.assign(appointment, patch);

  // If there's an associated preRequest, sync requested_date and requested_time as well!
  const preRequest = dataStore.preRequests.find((pr) => pr.appointment_id === id);
  if (preRequest) {
    if (patch.scheduled_datetime) {
      const parts = String(patch.scheduled_datetime).split('T');
      preRequest.requested_date = parts[0];
      preRequest.requested_time = parts[1] ? parts[1].slice(0, 5) : '09:00 AM';
    } else {
      if (patch.appointment_date) preRequest.requested_date = patch.appointment_date;
      if (patch.appointment_time) preRequest.requested_time = patch.appointment_time;
    }
    if (patch.doctor_id) preRequest.doctor_id = Number(patch.doctor_id);
    if (patch.department) preRequest.department = patch.department;
  }

  return appointment;
}

/**
 * Boot-time repair (bootstrap.js): older appointments only carry the
 * availability slot they were booked against, not the doctor, so doctor-level
 * conflict checks never saw them. Resolves doctor_id through that slot.
 * Idempotent; returns how many rows were filled in.
 */
function backfillDoctorIds() {
  let filled = 0;
  dataStore.appointments.forEach((appointment) => {
    if (appointment.doctor_id || !appointment.availability_id) return;
    const slot = dataStore.doctorAvailabilities.find(
      (a) => a.availability_id === Number(appointment.availability_id),
    );
    if (slot && slot.doctor_id) {
      appointment.doctor_id = Number(slot.doctor_id);
      filled++;
    }
  });
  return filled;
}

module.exports = { findAll, findOne, create, update, backfillDoctorIds };
