'use strict';

import { Outlet } from 'react-router-dom';
import SharedNav from '../../components/layout/SharedNav.jsx';
import { useSession } from '../../auth/useSession.js';
import { usePageStyles } from '../../hooks/usePageStyles.js';
import adminCss from '../../styles/admin/admin.css?inline';

/**
 * Ported from Admin/shared-nav.js, same module gates. "Roles & Staff"
 * (screen-04, the custom-RBAC matrix) is gone: staff roles are managed from
 * the People directory, and the old URL redirects there.
 */
const LINKS = [
  { href: '/Admin/screen-01-dashboard.html', label: 'Dashboard' },
  { href: '/Admin/screen-02-departments.html', label: 'Departments', module: 'ADMISSIONS' },
  { href: '/Admin/screen-03-inventory.html', label: 'Inventory Catalog', module: 'INVENTORY' },
  { href: '/Admin/screen-05-people.html', label: 'People' },
];

export default function AdminLayout() {
  usePageStyles(adminCss);
  const { tenant } = useSession();
  return (
    <>
      <SharedNav
        roleName="Admin"
        brandName={tenant?.organization_name || 'Federico'}
        links={LINKS}
      />
      <Outlet />
    </>
  );
}

