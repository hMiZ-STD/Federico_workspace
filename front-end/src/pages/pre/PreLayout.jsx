'use strict';

import { Outlet } from 'react-router-dom';
import { useSession } from '../../auth/useSession.js';
import AppNavbar from '../../components/layout/AppNavbar.jsx';
import { usePageStyles } from '../../hooks/usePageStyles.js';
import baseCss from '../../styles/pre/base.css?inline';
import layoutCss from '../../styles/pre/layout.css?inline';
import componentsCss from '../../styles/pre/components.css?inline';

const LINKS = [
  { href: '/PRE/pages/PRE.html', label: 'Dashboard' },
  { href: '/PRE/pages/patient-records.html', label: 'Patient Record' },
  { href: '/PRE/pages/doctor.html', label: 'Doctor Availability' },
  { href: '/PRE/pages/appointment.html', label: 'Create Appointment' },
  { href: '/PRE/pages/hom.html', label: 'HOM Requests' },
];

export default function PreLayout() {
  usePageStyles(baseCss, layoutCss, componentsCss);
  const { tenant } = useSession();

  return (
    <>
      <AppNavbar
        roleName="PRE"
        brandName="Federico"
        hospitalName={tenant?.organization_name}
        links={LINKS}
      />
      <Outlet />
    </>
  );
}
