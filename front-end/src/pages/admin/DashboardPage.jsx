'use strict';

import { api } from '../../api/index.js';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useSession } from '../../auth/useSession.js';
import { formatCurrency } from '../../lib/formatters.js';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/**
 * Ported from Admin/screen-01-dashboard.html + dashboard.js.
 *
 * DEFECT D3 again: the subscription usage card reads `liveRates?.base_fee`,
 * but GET /platform/rates returns `base_platform_fee`. The base platform fee
 * therefore always falls back to 3000 here while the per-resource rates do
 * update. Carried forward unchanged (constraint 1); the same bug lives in
 * signup/org-signup.js.
 *
 * The terminal and warehouse counts are hardcoded at 2 and 1 in the original -
 * there is no endpoint for them. Also preserved.
 */
export default function AdminDashboardPage() {
  useDocumentTitle('Dashboard | Federico Hospital Admin');
  const { hasModule } = useSession();
  const locked = !hasModule('ANALYTICS');

  const { data } = useApi(async () => {
    if (locked) return null;
    const [wards, beds, patients, rawLedgers, items, staff, payments, admissions, preRequests, appointments, doctors, liveRates] =
      await Promise.all([
        api.wards.list().catch(() => []),
        api.wards.beds().catch(() => []),
        api.patients.list().catch(() => []),
        api.billing.ledger.listAll().catch(() => []),
        api.inventory.items.list().catch(() => []),
        api.rbac.staff().catch(() => []),
        api.billing.payments.list().catch(() => []),
        api.admissions.list().catch(() => []),
        api.preRequests.list().catch(() => []),
        api.appointments.list().catch(() => []),
        api.doctors.list().catch(() => []),
        api.platform.rates.get().catch(() => null),
      ]);

    // Each ledger's true total is the sum of its entries.
    const ledgers = await Promise.all(
      (rawLedgers || []).map(async (ledger) => {
        const entries = await api.billing.ledger.entries(ledger.ledger_id).catch(() => []);
        return { ...ledger, total: entries.reduce((sum, e) => sum + Number(e.amount || 0), 0) };
      }),
    );

    return { wards, beds, patients, ledgers, items, staff, payments, admissions, preRequests, appointments, doctors, liveRates };
  }, [locked]);

  if (locked) {
    return (
      <main className="dashboard-container">
        <div className="header-section">
          <div>
            <h1 className="h1" style={{ marginBottom: 8 }}>Hospital Operations &amp; Analytics</h1>
            <p className="body-text" id="subtitle">Real-time overview of clinical flow, resource capacity, and SaaS usage</p>
          </div>
        </div>
        <div className="analytics-locked" id="analytics-locked-message">
          Administrative Analytics is not enabled for this organization. Contact platform
          administration to enable it.
        </div>
      </main>
    );
  }

  const d = data || {};
  const beds = d.beds || [];
  const wards = d.wards || [];
  const ledgers = d.ledgers || [];
  const items = d.items || [];
  const staff = d.staff || [];

  const occupied = beds.filter((b) => b.status === 'OCCUPIED').length;
  const occupancyPct = beds.length ? Math.round((occupied / beds.length) * 100) : 0;
  const totalRevenue = ledgers.reduce((s, l) => s + Number(l.total || 0), 0);
  const collected = (d.payments || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0);
  const activeInpatients = (d.admissions || []).filter((a) => a.status !== 'DISCHARGED').length;
  const dischargeQueue = (d.preRequests || []).filter(
    (p) => p.status === 'DISCHARGE_REQUESTED' || p.status === 'DISCHARGE_APPROVED',
  ).length;

  const r = d.liveRates;
  const basePlatformFee = Number(r?.base_fee ?? 3000); // D3
  const bedRate = Number(r?.rates?.GENERAL_BEDS ?? 150);
  const docRate = Number(r?.rates?.DOCTOR_SEATS ?? 150);
  const staffRate = Number(r?.rates?.STAFF_SEATS ?? 200);
  const termRate = Number(r?.rates?.BILLING_TERMINALS ?? 500);
  const whRate = Number(r?.rates?.WAREHOUSES ?? 1000);
  const admRate = Number(r?.rates?.PATIENT_ADMISSIONS ?? 10);

  const bedCount = beds.length;
  const docCount = (d.doctors || []).length;
  const staffCount = staff.length;
  const terminalsCount = 2;
  const warehouseCount = 1;
  const admCount = (d.admissions || []).length;

  const bedCost = bedCount * bedRate;
  const docCost = docCount * docRate;
  const staffCost = staffCount * staffRate;
  const terminalsCost = terminalsCount * termRate;
  const warehouseCost = warehouseCount * whRate;
  const admCost = admCount * admRate;

  const subtotal = basePlatformFee + bedCost + docCost + staffCost + terminalsCost + warehouseCost + admCost;
  const gst = Math.round(subtotal * 0.18);
  const totalMonthly = subtotal + gst;

  const byStatus = {};
  ledgers.forEach((l) => {
    const key = l.status || 'UNKNOWN';
    if (!byStatus[key]) byStatus[key] = { count: 0, total: 0 };
    byStatus[key].count += 1;
    byStatus[key].total += Number(l.total || 0);
  });

  const byRole = {};
  staff.forEach((s) => {
    byRole[s.actor_role] = (byRole[s.actor_role] || 0) + 1;
  });

  const lowStock = items.filter((i) => i.stock_quantity < i.reorder_level);

  const usageCard = (label, amount, sub) => (
    <StatCard label={label} value={inr(amount)} sub={sub} />
  );

  return (
    <main className="dashboard-container">
      <PageHeader
        title="Hospital Operations & Analytics"
        subtitle="Real-time overview of clinical flow, resource capacity, and SaaS usage"
      />

      <div>
        <div className="metrics-grid">
          <StatCard
            label="Active Inpatients"
            value={activeInpatients}
            sub={dischargeQueue + ' pending discharge'}
            variant="warning"
          />
          <StatCard
            label="Bed Occupancy"
            value={occupancyPct + '%'}
            sub={occupied + ' of ' + beds.length + ' beds occupied'}
            variant={occupancyPct >= 75 ? 'warning' : 'success'}
          />
          <StatCard
            label="Registered Patients"
            value={(d.patients || []).length}
            sub="Across all departments"
            variant="primary"
          />
          <StatCard
            label="Total Appointments"
            value={(d.appointments || []).length}
            sub="Booked through portal / PRE"
            variant="info"
          />
          <StatCard
            label="Total Revenue Billed"
            value={formatCurrency(totalRevenue)}
            sub="Cumulative hospital charges"
            variant="default"
          />
          <StatCard
            label="Payments Settled"
            value={formatCurrency(collected)}
            sub="Direct cash & online receipts"
            variant="success"
          />
        </div>

        <div className="card" style={{ marginBottom: 24, padding: '20px 24px', borderLeft: '4px solid var(--primary, #0D9488)', background: '#FAFDFB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary, #0F172A)' }}>
                Monthly Cloud Subscription &amp; Resource Usage
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', margin: '4px 0 0 0' }}>
                Pay-As-You-Scale usage breakdown {'·'} Dynamic capacity with no artificial quota limits
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, background: '#E6FFFA', color: '#0D9488', padding: '4px 10px', borderRadius: 999, border: '1px solid #99F6E4' }}>
              ACTIVE PLAN
            </span>
          </div>
          <div id="subscription-usage-breakdown">
            {!data ? (
              <EmptyState title="Calculating live monthly usage…" />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16, fontSize: 13 }}>
                  {usageCard('Base Platform Fee', basePlatformFee, 'All 8 modules unlocked')}
                  {usageCard('Inpatient Beds', bedCost, bedCount + ' beds (@ ' + inr(bedRate) + '/bed)')}
                  {usageCard('Doctors & Staff', docCost + staffCost, docCount + ' docs (@ ' + inr(docRate) + ') + ' + staffCount + ' staff (@ ' + inr(staffRate) + ')')}
                  {usageCard('Hardware & Warehouse', terminalsCost + warehouseCost, terminalsCount + ' terminals + ' + warehouseCount + ' warehouse')}
                  {usageCard('Patient Volume Usage', admCost, admCount + ' admissions (@ ' + inr(admRate) + '/adm)')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#F1F5F9', borderRadius: 8, fontSize: 13 }}>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Subtotal: <strong style={{ color: 'var(--text-primary)' }}>{inr(subtotal)}</strong> &nbsp;{'·'}&nbsp; GST (18%):{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{inr(gst)}</strong>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary, #0D9488)' }}>
                    Total Monthly Cloud Charge: <span style={{ fontSize: 18, fontWeight: 800 }}>{inr(totalMonthly)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="main-grid">
          <div className="left-column">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Ward Occupancy</h2>
                <p className="card-description">Inpatient beds in use vs. total capacity, per ward</p>
              </div>
              <div className="card-content">
                <div id="ward-occupancy-list">
                  {!data ? (
                    <EmptyState title="Loading…" />
                  ) : wards.length === 0 ? (
                    <EmptyState title="No wards configured" description="Add wards and clinical departments in the Departments tab." />
                  ) : (
                    wards.map((ward) => {
                      const wardBeds = beds.filter((b) => b.ward_id === ward.ward_id);
                      const wardOccupied = wardBeds.filter((b) => b.status === 'OCCUPIED').length;
                      const pct = wardBeds.length ? Math.round((wardOccupied / wardBeds.length) * 100) : 0;
                      return (
                        <div style={{ marginBottom: 14 }} key={ward.ward_id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 500 }}>{ward.ward_name}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{wardOccupied}/{wardBeds.length} beds ({pct}%)</span>
                          </div>
                          <div className="progress-bar-bg" style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: pct + '%', borderRadius: 999, background: pct >= 90 ? 'var(--error, #EF4444)' : pct >= 70 ? 'var(--warning, #F59E0B)' : 'var(--success, #10B981)' }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2 className="card-title">Clinical Billing Overview</h2></div>
              <div className="card-content" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Status</th><th>Ledgers</th><th>Total</th></tr></thead>
                    <tbody id="billing-summary-tbody">
                      {Object.keys(byStatus).length === 0 ? (
                        <EmptyState asTableRow colSpan={3} title="No billing ledgers yet." />
                      ) : (
                        Object.entries(byStatus).map(([status, stats]) => (
                          <tr key={status}>
                            <td style={{ fontWeight: 600 }}>{status}</td>
                            <td>{stats.count}</td>
                            <td>{formatCurrency(stats.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="right-column">
            <div className="card">
              <div className="card-header"><h2 className="card-title">Low Stock Alerts</h2></div>
              <div className="card-content">
                <div id="low-stock-list">
                  {!data ? (
                    <EmptyState title="Loading…" />
                  ) : lowStock.length === 0 ? (
                    <EmptyState title="All items above reorder level" description="Stock quantities across all items are healthy." />
                  ) : (
                    lowStock.map((item) => (
                      <div className="alert-card" key={item.item_id} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-base)', padding: 12, marginBottom: 12 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--error-text, #991B1B)', margin: '0 0 4px 0' }}>{item.item_name}</p>
                        <p style={{ fontSize: 12, color: 'var(--error-text, #991B1B)', margin: 0 }}>
                          Stock: {item.stock_quantity} (Reorder Level: {item.reorder_level})
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2 className="card-title">Staff Distribution</h2></div>
              <div className="card-content">
                <div id="staff-breakdown">
                  {!data ? (
                    <EmptyState title="Loading…" />
                  ) : Object.keys(byRole).length === 0 ? (
                    <EmptyState title="No staff accounts registered" description="Invite team members in the People directory." />
                  ) : (
                    Object.entries(byRole).map(([role, count]) => (
                      <div key={role} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 14 }}>{role}</span>
                        <span style={{ fontWeight: 600 }}>{count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

