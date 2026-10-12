# Project Memory & Learned Insights

Persistent memory, architectural models, component indexes, and engineering standards for the Federico Hospital Administrative Operations Platform.

---

## 🚫 Restricted Files & Directories (Strict Prohibition)
The following 7 paths are strictly prohibited from being read, parsed, or accessed under any circumstances:
1. `D:\Federico_workspace\LICENSE`
2. `D:\Federico_workspace\react-migration-plan.md`
3. `D:\Federico_workspace\SRS.pdf`
4. `D:\Federico_workspace\Figma`
5. `D:\Federico_workspace\videos`
6. `D:\Federico_workspace\definitions.yml`
7. `D:\Federico_workspace\DomainExpertInteraction.md`

---

## 🧠 System Architecture & Domain Model

### 1. Platform Scope
- **Strictly Non-Clinical**: Federico handles administrative, operational, financial, and logistical workflows (patient registration, triage, bed allocation, inventory consumption, staff scheduling, ledgers, insurance claims, billing). It does not provide medical diagnoses or clinical decision support.

### 2. Multi-Tenancy & Data Isolation
- **Organization Boundary**: Organizations (`organization_id`) represent hospital networks or independent facilities. Every tenant-scoped entity (`users`, `patients`, `admissions`, `wards`, `inventoryItems`, `services`, `ledgers`) belongs to an organization.
- **Fail-Closed Module Entitlements**: Organizations purchase specific modules (`APPOINTMENTS`, `ADMISSIONS`, `INVENTORY`, `BILLING`, `INSURANCE`, `ANALYTICS`, `DOCTOR`, `PATIENT`, `LEADERSHIP`). If an organization has not enabled a module, requests to routes gated by `requireModule(MODULE_CODE)` fail with HTTP 403.
- **Dynamic RBAC & Role Permission Vocabularies**: Beyond the 5 base roles (`HOM`, `Patient`, `FA`, `PRE`, `Admin`), organizations can create custom roles with permissions drawn from a unified `resource:mode` catalog (e.g., `doctor:read`, `wardAdmin:write`, `billing:write`).

### 3. Unified Email-Driven Authentication
- Every user signs in through `/login/login-page.html`.
- Staff emails follow the format `<name>.<role_tag>@<hospital_email_domain>` (e.g., `rekha.pre@citygen.com`, `admin.hom@citygen.com`, `farah.fa@citygen.com`, `owner.admin@citygen.com`).
- Platform Super Users sign in as `<name>.platform@federico.com`.
- Any non-hospital email is routed to the Patient portal with a hospital selector.
- Sessions are token-based (24-byte hex in `sessionStore`), isolated per browser tab via `sessionStorage`. Updating a staff user's role revokes all active sessions for that user immediately.

### 4. Operational State Machines & Lifecycles
- **Patient Intake & OPD**:
  * Online pre-registration / appointment booking creates a `preRequest`.
  * Status flow: `PENDING` → `APPROVED` / `SUGGESTED` / `REJECTED`.
  * Walk-in emergency intake allows immediate triage and priority bed requisition.
- **Inpatient Bed & Ward Management**:
  * Wards house beds with statuses: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`.
  * PRE bed requisition → HOM allocates physical bed → automated admission cascade creates `admissions` row and initializes `ledgers` row.
  * Discharge gating: HOM medical discharge approval + FA financial settlement clearance required before administrative discharge.
- **Service Charges & Financial Ledger**:
  * Services recorded with category, base cost, and tax. Consumable inventory usage automatically links to billable service lines.
  * Charge posts require dual-step approval (HOM/Leader submission → FA approval) before entering the patient's active ledger.
  * Settled ledgers (`PAID`) become strictly immutable.
- **Platform Subscription & Revenue Model**:
  * Platform billing calculates monthly recurring revenue based on enabled base modules multiplied by hospital branch count, plus resource-level consumption tiers (e.g., general beds, ICU beds, warehouses, staff seats).

---

## 📜 Mandatory Engineering Rules & Standards

### A. General Development Process (Mandatory 4-Step Cycle)
1. **Understand**:
   - Read and clarify all requirements before modifying code.
   - Explore existing patterns, helper functions, and shared utilities.
   - Always reuse existing components, hooks, formatters, and validators.
2. **Plan**:
   - Formulate a brief plan before editing: Goal, files to touch, approach, ordered steps, risks (API breaks, state regressions), and test strategy.
   - Seek user alignment for high-risk changes (API contracts, data store schema, code deletions).
3. **Execute**:
   - One step at a time. Keep diffs focused. Never mix refactors, bug fixes, and feature additions.
   - If the implementation diverges from the plan, pause and update the plan.
4. **Verify**:
   - Run tests, linting, and formatters (`npm test`, `npm run lint`).
   - Clean up debug code (`console.log`, commented-out blocks). Report verified diffs.
5. **Memory Maintenance Protocol (Mandatory)**:
   - Whenever any change is made to the codebase, immediately update [`PROJECT_MEMORY.md`](file:///d:/Federico_workspace/PROJECT_MEMORY.md) with details of the change, design decisions, and updated inferences.

---

### B. Frontend Engineering Standards (React 19 / Vite)
- **Component Hygiene**:
  * Small, single-purpose function components using hooks.
  * Presentation only: components must not execute raw network requests (`fetch`/`axios`).
- **Separation of Concerns**:
  * UI Components (`src/components/`, `src/pages/`) → Rendering and presentation.
  * Custom Hooks (`src/hooks/`) → Stateful logic, polling, side-effects, and data orchestration.
  * API Layer (`src/api/`) → All backend network communication.
- **State Management & Data Locality**:
  * Keep state as local as possible. Lift to Context only when multiple routes/components require shared access.
  * Never duplicate server state across multiple parallel states.
  * Always handle **loading**, **error**, and **empty** states explicitly in the UI.
- **Performance & Rendering**:
  * Never mutate state directly.
  * Use stable, unique `key` props (never use array indices for dynamic lists).
  * Do not add `useMemo` or `useCallback` without concrete justification.
- **Style Isolation**:
  * Portal stylesheets must be imported with `?inline` and mounted via `usePageStyles` to prevent CSS cross-contamination across lazy-loaded routes.
  * Use shared design tokens (`src/styles/design-tokens.css`) for consistent typography, elevation, and palette.
- **Accessibility & Security**:
  * Semantic HTML elements (`<header>`, `<main>`, `<nav>`, `<section>`).
  * Explicit labels for all form inputs and accessible aria roles for dynamic alerts/modals.
  * Never use `dangerouslySetInnerHTML` unless input is thoroughly sanitized.

---

### C. Backend Engineering Standards (Express / Clean Architecture)
- **Layered Clean Architecture**:
  * Flow: `HTTP Request` → `Middleware` → `Route` → `Validator` → `Controller` → `Service` → `DataStore / Persist`.
  * Controllers: Parse request parameters, invoke service methods, format standardized JSON envelopes. Never directly access or mutate `dataStore`.
  * Services: Encapsulate all business logic, invariant enforcement, state mutations, and ID assignments.
- **Schema Validation Integrity**:
  * All mutation endpoints must declare validation rules using `validators/engine.js`.
  * Do not strip un-whitelisted fields (mimic Nest ValidationPipe).
  * Preserve exact check ordering (`isNotEmpty` before `isString`, etc.) to match test expectations.
- **Tenant & Module Gating**:
  * Every tenant-scoped endpoint must enforce `req.tenant.organizationId`.
  * Feature routes must mount `requireModule(MODULE_CODE)` before actor authorization.
  * Authorization must use `authorize(legacyRoles, resource, mode)` or `requireActor(...)`.
- **Crash-Safe Persistence**:
  * State is held in-memory in `dataStore.js` and synced to disk (`data/db.json`) atomically.
  * Mutations must trigger `persistOnMutation` via `res.on('finish')`.
  * Disk writes use a temporary file (`.tmp`) and atomic rename with exponential backoff for Windows locks.
  * In test mode (`NODE_ENV === 'test'`), skip disk writes to maintain test isolation.
- **Standardized Error Handling**:
  * All errors must use standard HTTP status codes (`400`, `401`, `403`, `404`, `409`, `429`, `500`) with consistent JSON envelopes (`{ statusCode, message, error }`).
  * Never leak uncaught exceptions or internal stack traces in production responses.
- **Security & Hygiene**:
  * Keep Helmet security headers, rate limiting (global, auth, upload), and `sanitizeInput` active.
  * Worker script CSP must include `blob:` to support Vite HMR web workers.

---

## 🗂️ Comprehensive File-by-File Catalog & Inferences

### 1. Root & Database Layer
- [`.gitignore`](file:///d:/Federico_workspace/.gitignore): Ignores `node_modules`, build artifacts (`dist/`), runtime logs (`logs/`), environment secrets (`.env`), and persistent runtime snapshots (`data/db.json`).
- [`README.md`](file:///d:/Federico_workspace/README.md): Primary project documentation detailing non-clinical scope, layered architecture, demo credentials, route tables, and test instructions.
- [`Database/ER_diagrams.png`](file:///d:/Federico_workspace/Database/ER_diagrams.png): Visual entity-relationship diagram representing database tables and foreign key relations.
- [`Database/Federico_Schemas.pdf`](file:///d:/Federico_workspace/Database/Federico_Schemas.pdf): Formal schema documentation detailing table structures, column constraints, and relationships.

---

### 2. Backend Files (`back-end/`)

#### Core & Server Bootstrap
- [`server.js`](file:///d:/Federico_workspace/back-end/server.js): Server entry point. Calls `persist.load()`, executes `runBootReconciliation()`, binds Express to port 3000, and attaches graceful shutdown handlers (`SIGINT`/`SIGTERM`) to flush state.
- [`src/app.js`](file:///d:/Federico_workspace/back-end/src/app.js): Express application factory (`createApp`). Configures Helmet, CORS, rate limiting, body parsers, XSS sanitizer, request logger, session/tenant middleware, mutation persistence, Swagger UI, static uploads, and error handlers.
- [`src/bootstrap.js`](file:///d:/Federico_workspace/back-end/src/bootstrap.js): Boot reconciliation logic. Ensures permission catalog is populated, synchronizes default organization module flags, backfills email domains, and backfills doctor IDs on legacy appointments.

#### Configuration (`src/config/`)
- [`env.js`](file:///d:/Federico_workspace/back-end/src/config/env.js): 12-factor environment loader with fallback defaults for `PORT` (3000), `HOST`, `DB_PATH`, `PERSIST_DEBOUNCE_MS`, and `SESSION_SECRET`.
- [`defaultClinicalCatalog.js`](file:///d:/Federico_workspace/back-end/src/config/defaultClinicalCatalog.js): Default baseline for newly provisioned hospitals: 6 departments/wards, 19 standard billable services, and 14 non-clinical inventory items.
- [`resourceCatalog.js`](file:///d:/Federico_workspace/back-end/src/config/resourceCatalog.js): Resource consumption definitions per module (e.g., bed types for ADMISSIONS, warehouses/seats for INVENTORY) and calculation helpers for resource billing.
- [`serviceCatalog.js`](file:///d:/Federico_workspace/back-end/src/config/serviceCatalog.js): Monthly base prices for modules and total cost calculation functions (`computeCost`).
- [`swagger.js`](file:///d:/Federico_workspace/back-end/src/config/swagger.js): Swagger UI setup mounting OpenAPI documentation at `/api`.
- [`index.js`](file:///d:/Federico_workspace/back-end/src/config/index.js): Barrel export for environment, catalogs, and Swagger configurations.

#### Store & Durability (`src/store/`)
- [`dataStore.js`](file:///d:/Federico_workspace/back-end/src/store/dataStore.js): Central in-memory database holding arrays for 40 entities (roles, users, patients, doctors, admissions, ledgers, inventory, organizations, etc.).
- [`persist.js`](file:///d:/Federico_workspace/back-end/src/store/persist.js): Crash-safe JSON snapshotting to `data/db.json`. Writes to `.tmp` file and performs atomic renames with Windows lock retries and corruption backups.
- [`sessionStore.js`](file:///d:/Federico_workspace/back-end/src/store/sessionStore.js): In-memory session map. Generates 24-byte hex tokens and provides session revocation utilities.

#### Middleware (`src/middleware/`)
- [`actorAccess.js`](file:///d:/Federico_workspace/back-end/src/middleware/actorAccess.js): Dynamic RBAC authorization (`authorize`). Evaluates legacy role headers, actor session roles, and dynamic permissions from `customRoles`.
- [`errorHandler.js`](file:///d:/Federico_workspace/back-end/src/middleware/errorHandler.js): Global error handling middleware returning standardized error JSON envelopes.
- [`fileUpload.js`](file:///d:/Federico_workspace/back-end/src/middleware/fileUpload.js): Multer configurations for document, branding, and inventory attachment uploads with file size and MIME checks.
- [`notFoundHandler.js`](file:///d:/Federico_workspace/back-end/src/middleware/notFoundHandler.js): 404 handler for unmatched routes.
- [`persistOnMutation.js`](file:///d:/Federico_workspace/back-end/src/middleware/persistOnMutation.js): Intercepts `res.on('finish')` on non-GET successful responses (< 400) to trigger debounced disk persistence.
- [`platformAccess.js`](file:///d:/Federico_workspace/back-end/src/middleware/platformAccess.js): Guard restricting access to platform super-users (`req.session.isPlatformUser`).
- [`requestLogger.js`](file:///d:/Federico_workspace/back-end/src/middleware/requestLogger.js): Morgan-like HTTP access logger writing to console and log files.
- [`security.js`](file:///d:/Federico_workspace/back-end/src/middleware/security.js): Security suite: Helmet CSP headers, global rate limiter (10k/15m), auth rate limiter (200/15m), upload rate limiter, and recursive XSS sanitizer.
- [`session.js`](file:///d:/Federico_workspace/back-end/src/middleware/session.js): Session extraction from Bearer headers/cookies and `requireSession` / `requireActor` guards.
- [`tenant.js`](file:///d:/Federico_workspace/back-end/src/middleware/tenant.js): Multi-tenancy middleware (`attachTenant`, `requireTenant`) and module entitlement gate (`requireModule`).

#### Validation (`src/validators/`)
- [`engine.js`](file:///d:/Federico_workspace/back-end/src/validators/engine.js): Declarative schema validator engine implementing checks for types, email, ISO date, phone numbers, and formatting NestJS-compatible error arrays.
- Validator files (`admission`, `appointment`, `auth`, `billing`, `doctor`, `inventory`, `patient`, `platform`, `preRequest`, `rbac`, `request`, `ward`): Field-level validation rules for all mutation endpoints.

#### Controllers (`src/controllers/`)
- 17 controllers mapping HTTP requests to service methods, enforcing tenant contexts, and sending structured JSON responses.

#### Services (`src/services/`)
- 17 domain services handling all business logic, state machines, invariants, and transactional updates across organizations, patients, appointments, admissions, wards, inventory, billing, RBAC, subscriptions, and activities.

#### Utilities (`src/utils/`)
- [`emailIdentity.js`](file:///d:/Federico_workspace/back-end/src/utils/emailIdentity.js): Domain parsing, actor tagging, domain validation, and suggestions.
- [`logger.js`](file:///d:/Federico_workspace/back-end/src/utils/logger.js) & [`logManager.js`](file:///d:/Federico_workspace/back-end/src/utils/logManager.js): System logging utilities.
- [`maxId.js`](file:///d:/Federico_workspace/back-end/src/utils/maxId.js): Helper calculating maximum ID in a collection for sequential auto-incrementation.
- [`password.js`](file:///d:/Federico_workspace/back-end/src/utils/password.js): Bcrypt hashing and password verification.
- [`patientOwnership.js`](file:///d:/Federico_workspace/back-end/src/utils/patientOwnership.js): Patient-record ownership verification.
- [`roles.js`](file:///d:/Federico_workspace/back-end/src/utils/roles.js): Role ID to role name mappings.
- [`sendResult.js`](file:///d:/Federico_workspace/back-end/src/utils/sendResult.js): Standardized response serialization helper.
- [`tenant.js`](file:///d:/Federico_workspace/back-end/src/utils/tenant.js): Constants for module codes and tenant helpers.

---

### 3. Frontend Files (`front-end/`)

#### Core & Architecture
- [`index.html`](file:///d:/Federico_workspace/front-end/index.html): HTML entry point loading Google Fonts and `/src/main.jsx`.
- [`vite.config.js`](file:///d:/Federico_workspace/front-end/vite.config.js): Vite configuration providing HTML fallback rewriting for legacy `.html` route paths.
- [`src/main.jsx`](file:///d:/Federico_workspace/front-end/src/main.jsx): React 19 entry point mounting `SessionProvider`, global design tokens, material components, feedback CSS, and `RouterProvider`.
- [`src/routes.jsx`](file:///d:/Federico_workspace/front-end/src/routes.jsx): Complete React Router v7 configuration with code-split lazy routes, `RequireModule` guards, and suspense fallbacks.

#### API Layer (`src/api/`)
- [`client.js`](file:///d:/Federico_workspace/front-end/src/api/client.js): Core HTTP client wrapping `fetch` with timeouts, abort controllers, Bearer token injection, multipart upload helpers, and response unwrapping.
- [`session.js`](file:///d:/Federico_workspace/front-end/src/api/session.js): Token storage in `sessionStorage` for tab-isolated authentication.
- [`errors.js`](file:///d:/Federico_workspace/front-end/src/api/errors.js): `ApiError` class and message extraction utilities.
- [`endpoints/`](file:///d:/Federico_workspace/front-end/src/api/endpoints/): 14 modular API clients covering auth, admissions, appointments, billing, doctors, inventory, marketplace, patients, platform, pre-requests, rbac, uploads, and wards.

#### Authentication (`src/auth/`)
- [`SessionContext.jsx`](file:///d:/Federico_workspace/front-end/src/auth/SessionContext.jsx): React context managing current user session, tenant info, login, and logout.
- [`RequireModule.jsx`](file:///d:/Federico_workspace/front-end/src/auth/RequireModule.jsx): Route guard checking organization module enablement and rendering `ModuleLock` screen if unsubscribed.
- [`actorHome.js`](file:///d:/Federico_workspace/front-end/src/auth/actorHome.js): Mapping actor roles to their default home dashboard routes.

#### Components (`src/components/`)
- **Shared CSS Directory (`src/components/css/`)**:
  - `app-navbar.css`: Universal navigation bar styling with responsive layout, role badges, and brand aesthetics.
  - `page-header.css`: Header titles, subtitles, breadcrumbs, and action CTA slots consuming design tokens.
  - `stat-card.css`: Metric and KPI card styling with semantic color variants (`primary`, `success`, `warning`, `error`, `info`).
  - `tab-nav.css`: Tab switchers supporting `pills` and `underline` styles with notification badges.
  - `empty-state.css`: Zero-state placeholder styling for standalone containers and table rows.
  - `search-toolbar.css`: Search query input, filter dropdowns, and action button bar.
  - `dialog-shell.css`: Standard modal shell container, header, body, and footer layout.
- **Layout (`src/components/layout/`)**:
  - `AppNavbar.jsx`: Universal top navigation bar across all portals (`Admin`, `HOM`, `PRE`, `FA`, `Patient`, `Platform`). Automatically detects route active states for both standard paths and FA hash routes (`#/ledger`, `#/charges`, `#/eod`). Supports user profile chip, brand label, and logout.
  - `PageHeader.jsx`: Standardized page banner with title, subtitle, breadcrumb trail, and action buttons.
  - `DialogShell.jsx`: Standard modal wrapper built on `Modal.jsx` with close button, title, and action footer.
  - `Modal.jsx`: Portal-based modal overlay with Escape and backdrop click dismiss handlers.
  - `SharedNav.jsx`: Backward-compatible adapter delegating to `AppNavbar`.
- **UI Primitives (`src/components/ui/`)**:
  - `StatCard.jsx`: Universal KPI card with semantic variant coloring, value formatting, subtext, and optional router link (`to`).
  - `TabNav.jsx`: Accessible tab switcher with ARIA tablist/tab semantics, `pills` or `underline` variants, and badge counts.
  - `EmptyState.jsx`: Zero-data placeholder supporting standalone blocks and `asTableRow` table rows with `colSpan`.
  - `SearchToolbar.jsx`: Universal search and filter toolbar for directories, catalogs, and logs.
  - `Badge.jsx`, `Button.jsx`, `Card.jsx`, `DataTable.jsx`, `Input.jsx`, `Tabs.jsx`.
- **Feedback**: `Toast.jsx`, `Dialog.jsx`, `FeedbackHost.jsx`, `feedback.js`.
- **Forms**: `DepartmentSelect.jsx`, `TaggedEmailInput.jsx`.

#### Custom Hooks (`src/hooks/`)
- [`useApi.js`](file:///d:/Federico_workspace/front-end/src/hooks/useApi.js): Generic async data fetching hook with loading, error, and reload states.
- [`usePolling.js`](file:///d:/Federico_workspace/front-end/src/hooks/usePolling.js): Periodic background polling hook with tab visibility pausing.
- [`usePageStyles.js`](file:///d:/Federico_workspace/front-end/src/hooks/usePageStyles.js): Injects inline CSS into `<head>` on mount and cleans up on unmount for style isolation.
- [`useDocumentTitle.js`](file:///d:/Federico_workspace/front-end/src/hooks/useDocumentTitle.js): Updates browser document title.
- [`useAsyncLock.js`](file:///d:/Federico_workspace/front-end/src/hooks/useAsyncLock.js): Prevents duplicate asynchronous form submissions.
- [`useSearchParam.js`](file:///d:/Federico_workspace/front-end/src/hooks/useSearchParam.js): Synchronizes state with URL search parameters.

#### Libraries & Utilities (`src/lib/`)
- Pure helpers for formatting currency (`formatters.js`), CSV export (`csv.js`), email domain parsing (`emailIdentity.js`), phone parsing (`phone.js`), insurance calculations (`insurance.js`), document printing (`printDocument.js`), role descriptions (`roleProfiles.js`), and input sanitization (`sanitizer.js`).

#### Portal Pages (`src/pages/`)
- **Admin**: Organization dashboard, ward/bed management, inventory catalog, staff management, and doctor directory.
- **HOM (Hospital Operations Manager)**: Real-time bed occupancy matrix, bed requests, patient flow, inventory usage, and restock orders.
- **PRE (Patient Relational Executive)**: Pre-registration intake, triage queues, OPD appointment scheduling, emergency intake, patient records, and doctor rosters.
- **FA (Finance Associate)**: Charge approvals, billing ledgers, end-of-day billing dispatch, final discharge settlements, and receipts.
- **Patient**: Patient portal dashboard, OPD booking with slot capacity, itemized bills, payment gateway simulation, and profile/insurance management.
- **Platform**: Platform Super User console for tenant provisioning, module toggle, MRR/ARR analytics, and rate configuration.
- **Public**: Landing page, marketplace hospital directory, patient registration, and hospital chain onboarding.

---

## 📝 Decisions & Change Log
- **2026-10-12**: Initialized `PROJECT_MEMORY.md` with strict prohibition ledger (7 blacklisted paths).
- **2026-10-12**: Completed comprehensive architecture mapping and codebase indexing across all permitted backend, frontend, and database files.
- **2026-10-12**: Documented frontend and backend coding standards and established mandatory protocol requiring all subsequent codebase changes to be recorded in this memory log.
- **2026-10-12**: **Shared UI Components Refactor**:
  - Created dedicated CSS directory at [`front-end/src/components/css/`](file:///d:/Federico_workspace/front-end/src/components/css/) consuming `design-tokens.css` without global collision risks.
  - Implemented 7 core reusable components: `AppNavbar`, `PageHeader`, `StatCard`, `TabNav`, `EmptyState`, `SearchToolbar`, `DialogShell`.
  - Enforced architectural decisions:
    - *No Legacy DOM ID Forwarding*: Kept component props clean and idiomatic React.
    - *No ModuleLock Artificial Padlocks*: Shared navigation and doctors management operate freely as hospital operations are interconnected; billing is based on physical resources (beds, staff, patient volume).
    - *Universal Route Matching*: `AppNavbar` natively supports standard URL paths and FA hash routes (`#/ledger`, `#/charges`, `#/eod`) with automatic active detection.
  - Migrated Portals & Layouts:
    - `PreLayout`, `FaLayout`, `PatientLayout`, `PlatformDashboardPage` $\rightarrow$ `AppNavbar`.
    - `Admin DashboardPage`, `Admin DepartmentsPage`, `Admin InventoryCatalogPage`, `HOM DashboardPage`, `HOM BedManagementPage`, `HOM InventoryPage`, `HOM PatientFlowPage`, `PRE PreDashboardPage`, `PRE DoctorRosterPage`, `PRE AppointmentPage`, `Patient BillingPage`, `Patient DashboardPage`, `Platform OverviewTab` $\rightarrow$ `StatCard` and `PageHeader`.
    - `Patient BillingPage`, `IntakeHubPage`, `PlatformDashboardPage` $\rightarrow$ `TabNav`.
    - `PRE DoctorRosterPage`, `PRE PatientRecordsPage`, `HOM InventoryPage`, `HOM PatientFlowPage` $\rightarrow$ `SearchToolbar`.
    - `PRE DoctorRosterPage`, `PRE IntakeHubPage`, `PRE PatientRecordsPage`, `HOM BedManagementPage`, `HOM InventoryPage`, `HOM PatientFlowPage`, `Admin PeoplePage`, `Admin DepartmentsPage`, `Patient BillingPage`, `PlatformDashboardPage` $\rightarrow$ `EmptyState`.
    - `StaffDialog`, `DoctorDialog` $\rightarrow$ `DialogShell`.
  - Code Verification: `oxlint` executed with 0 errors and 0 warnings across all 153 files; `vite build` completed successfully with zero bundle errors.
- **2026-10-12**: **Comprehensive Universal UI Component Audit & Deep Migration**:
  - Conducted an exhaustive AST-level and visual audit across all pages and portals (`PRE`, `HOM`, `FA`, `Patient`, `Admin`, `Platform`, `Public`):
    - **PRE Doctor Roster (`doctor.html`) & Records**: Converted [`DoctorRosterPage.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/DoctorRosterPage.jsx) and [`PatientRecordsPage.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/PatientRecordsPage.jsx) from legacy `.directory-header` containers to [`PageHeader`](file:///d:/Federico_workspace/front-end/src/components/layout/PageHeader.jsx) with responsive embedded [`SearchToolbar`](file:///d:/Federico_workspace/front-end/src/components/ui/SearchToolbar.jsx) action slots. Converted raw table empty and error rows in `DoctorRosterPage`, `PatientRecordsPage`, and [`TriageQueue.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/TriageQueue.jsx) to [`EmptyState asTableRow`](file:///d:/Federico_workspace/front-end/src/components/ui/EmptyState.jsx).
    - **PRE Modals & Popups**: Converted [`Patient360Modal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/Patient360Modal.jsx), [`SearchResultPopup.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/SearchResultPopup.jsx), [`RegisterWalkInPopup.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/RegisterWalkInPopup.jsx), [`RejectPopup.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/RejectPopup.jsx), [`SuggestPopup.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/SuggestPopup.jsx), and [`ApprovePopup.jsx`](file:///d:/Federico_workspace/front-end/src/pages/pre/ApprovePopup.jsx) from raw `createPortal` and legacy `PrePopup` wrappers to [`DialogShell`](file:///d:/Federico_workspace/front-end/src/components/layout/DialogShell.jsx) with standardized responsive sizing.
    - **HOM Portal Modals & Controls**: Converted all 6 HOM operational modals ([`AssignBedModal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/hom/AssignBedModal.jsx), [`BedDetailModal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/hom/BedDetailModal.jsx), [`LogUsageModal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/hom/LogUsageModal.jsx), [`PatientDetailModal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/hom/PatientDetailModal.jsx), [`PostServiceModal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/hom/PostServiceModal.jsx), [`RestockModal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/hom/RestockModal.jsx)) to [`DialogShell`](file:///d:/Federico_workspace/front-end/src/components/layout/DialogShell.jsx). Converted [`BedManagementPage.jsx`](file:///d:/Federico_workspace/front-end/src/pages/hom/BedManagementPage.jsx) header search controls to [`SearchToolbar`](file:///d:/Federico_workspace/front-end/src/components/ui/SearchToolbar.jsx).
    - **FA Portal & Public/Admin**: Converted [`SettlementSection.jsx`](file:///d:/Federico_workspace/front-end/src/pages/fa/SettlementSection.jsx) to [`PageHeader`](file:///d:/Federico_workspace/front-end/src/components/layout/PageHeader.jsx) and [`EmptyState`](file:///d:/Federico_workspace/front-end/src/components/ui/EmptyState.jsx). Converted [`MarketplacePage.jsx`](file:///d:/Federico_workspace/front-end/src/pages/public/MarketplacePage.jsx) and [`DashboardPage.jsx`](file:///d:/Federico_workspace/front-end/src/pages/admin/DashboardPage.jsx) legacy loading/empty states to [`EmptyState`](file:///d:/Federico_workspace/front-end/src/components/ui/EmptyState.jsx). Converted [`BillDetailsModal.jsx`](file:///d:/Federico_workspace/front-end/src/pages/patient/BillDetailsModal.jsx) to [`DialogShell`](file:///d:/Federico_workspace/front-end/src/components/layout/DialogShell.jsx).
  - Code Hygiene & Quality: Cleaned all unused imports (`faStyles.js`), verified 0 lint warnings and 0 lint errors with `oxlint` across 153 files, and validated production build with Vite passing cleanly (199 modules transformed, zero build issues).
- **2026-10-12**: **Dynamic Multi-Hospital Patient Authentication & Zero-Hardcoded Demo Credentials**:
  - Implemented Option A for multi-tenant patient accounts: scoped by `(email, organization_id)` in [`dataStore.users`](file:///d:/Federico_workspace/back-end/src/store/dataStore.js).
  - Enhanced [`auth.service.js`](file:///d:/Federico_workspace/back-end/src/services/auth.service.js):
    - Added `findUserByEmail(email, organizationId)` supporting exact tenant scoping and `findUsersByEmail(email)` for multi-facility account discovery.
    - Updated `login(email, password, requestedOrganizationId, expectedRole)`: single-hospital patients log in directly without any dropdown. Multi-hospital patients with the same password receive `{ requiresOrganizationSelection: true, organizations: [...] }`.
    - Updated `signup(payload)`: allows a patient to register at multiple hospital facilities under Option A.
    - Implemented `getDemoAccounts()` dynamically aggregating active organizations, role accounts, and platform super-user from `dataStore`.
  - Exposed endpoint `GET /auth/demo-accounts` in [`auth.controller.js`](file:///d:/Federico_workspace/back-end/src/controllers/auth.controller.js) and [`auth.routes.js`](file:///d:/Federico_workspace/back-end/src/routes/auth.routes.js).
  - Updated frontend:
    - Deprecated hardcoded `mockAccountsByOrg` dictionary in [`roleProfiles.js`](file:///d:/Federico_workspace/front-end/src/lib/roleProfiles.js).
    - Updated [`SessionContext.jsx`](file:///d:/Federico_workspace/front-end/src/auth/SessionContext.jsx) to handle `requiresOrganizationSelection`.
    - Rewrote [`LoginPage.jsx`](file:///d:/Federico_workspace/front-end/src/pages/public/LoginPage.jsx):
      - Clean initial form (zero dropdown upfront).
      - Loads demo tabs and credentials dynamically via `api.auth.demoAccounts()`.
      - Selecting a demo account automatically sets the matching `organization_id` so clicking Sign In logs directly into that hospital without dropdown popups or mismatch errors.
      - Shows the hospital selection dropdown only if a patient is registered across multiple hospitals.
  - Automated Verification: 23 backend test suites passed (145 tests), 0 lint errors/warnings with `oxlint` across 153 files, and Vite production bundle passed cleanly (199 modules).



