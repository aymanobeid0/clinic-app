# Dentara system and component design

Source: `design/dentara-refined.html`. Scope: the supplied frontend prototype and its reusable UI system. No backend, database, authentication service, or production synchronization architecture is established by this file. Browser rendering was not verified because local file navigation was blocked.

## Runtime structure

The reference is a self-contained HTML artifact with a root mount, embedded fonts/styles, and bundled JavaScript. React renders the application under StrictMode. The bundle includes calendar functionality styled through FullCalendar selectors and a canvas-based revenue visualization. Phosphor icons provide navigation, action, and status imagery.

The app selects screens through React state, rather than evidenced URL routes. Navigation clears search and status filters and closes mobile navigation. Data changes are held in memory and reset when the page reloads.

| State | Responsibility |
| --- | --- |
| Active screen | Dashboard initially; determines main screen content. |
| Language/direction | English initially; updates document `lang` and `dir` and application font. |
| Records | Seeded demo patient/appointment rows; updated on creation or status change. |
| Search and status | Combined derived filtering for the record table. |
| Reporting period | October or September 2026; changes selected sample summary values. |
| Overview/Clinical/Financial selection | Active segmented selection; financial mode is passed to the revenue chart. Do not assume comprehensive data filtering. |
| Dialog | Closed, new appointment, notifications, or selected record. |
| Toast | Feedback message cleared after 3500ms. |
| Mobile navigation | Sidebar visibility on narrow screens. |
| Draft date/time | Calendar creation defaults, initially 2026-10-10 and 11:30. |

## Component contracts

Names below are readable documentation names; the shipped bundle uses minified identifiers.

| Component | Contract and composition |
| --- | --- |
| App shell | Sidebar, header, workspace, footer; owns navigation, language, dialog, and record state. |
| Navigation item | Icon, localized label, optional count, active/hover/focus state; button-based selection. |
| Page heading | Title, description, optional primary action. |
| Metric strip | Four semantic summary cells with label, tabular value, unit, and comparison/context. |
| Card | White surface, 1px border, 14px radius; section heading, content, optional footer. |
| Revenue panel | Heading, legend, total, canvas chart, and revenue-versus-collection explanation. |
| Cost summary | Revenue and direct-cost progress bars, materials/lab and clinician breakdown, contribution margin, exclusions. |
| Record table | Search, status select, derived rows, detail actions, empty state, count/currency footer. |
| Status badge | Text plus dot, semantic foreground/background; supports Pending, Confirmed, Arrived, In treatment, Completed. |
| Calendar | Receives records, RTL flag, open-record callback, and create callback with date/time defaults. |
| Inventory table | Static sample stock and reorder indicators. |
| System showcase | Local Foundations/Components/Patterns selection; demonstration actions and clipboard swatches. |
| Dialog | Overlay, labeled heading, close action, scrollable body, footer; creation, patient details, or reminder variants. |
| Toast | Fixed elevated feedback surface with status announcement. |

## Record model represented by the demo

| Field | Meaning |
| --- | --- |
| `id` | Display identifier such as `PT-001`; new IDs derive from current array length. |
| `name`, `ar` | English/Arabic display names; creation assigns entered name to both. |
| `initials`, `color` | Avatar fallback and palette category. |
| `doctor`, `treatment` | Selected clinician and treatment strings. |
| `date`, `time` | Appointment date and time; legacy date fallback is 2026-10-10. |
| `status` | Appointment status string. |
| `balance` | Sample outstanding amount in MRU. |

A demo row combines patient identity and appointment data. A future persistent implementation should separate patients, appointments, treatments, and financial entries; that separation is a recommendation, not an existing schema.

## Interaction and feedback rules

- Creation uses a native form, required name/date/time fields, trimmed name, and name maximum length of 80. Native select options constrain doctor/treatment choices.
- Status changes update both the selected detail object and matching row, then show feedback.
- Search is case-insensitive across names and ID. Clear filters resets search and status together.
- Clicking the overlay background, close button, or Escape dismisses the dialog. Focus moves into the dialog, loops over enabled controls, and returns to its prior element on dismissal.
- CSV export uses a Blob and temporary object URL; columns are Patient, Treatment, Doctor, Balance MRU. The implementation joins raw values with commas; production export would need CSV escaping.
- Reminder previews select the first two Pending or Confirmed records. No transport or delivery integration exists.
- Swatch copy uses the Clipboard API when available, with toast fallback.

## Layout and cascade rules

Base styles are followed by `#dentara-refinement`; later rules override base values, while unaffected earlier rules remain active. Do not discard earlier media queries merely because a refinement exists. For example, the desktop sidebar remains 232px through the refinement, while the base 1000px rule still changes swatch columns and hides the demo label. The base `h1` rule under `.rtl` still applies its 1.6 line height.

| Width | Effective structural behavior |
| --- | --- |
| ≥1600px | Main padding 40px; metric values 34px. |
| ≤1200px | Main/header padding 28px; chart/cost ratio 1.5fr to minimum 280px; tighter spacing. |
| ≤1050px | Two-column metrics with row dividers; chart/cost, bottom, and component grids stack. |
| ≤1000px | Inherited swatch grid becomes three columns; demo label disappears. Refinement keeps cost card visible. |
| ≤720px | Menu-controlled sidebar, sticky 64px header, full-width workspace, two-column swatches, stacked form, wrapping controls, scrollable tables/calendar. |
| ≤380px | Smaller metrics, hidden treatment progress bars, truncated breadcrumb. |

Calendar-specific 720px styles preserve a horizontally scrollable calendar with a 780px minimum content width. Textual event details and the legend supplement event color.

## Boundaries and future work

The System Patterns tab describes persistent medical records, attachments, treatment plans, permission-aware finance, FDI dental charts, and explicit sync states. These are future patterns. Production work would require durable storage, access controls, audit trails, robust validation, financial calculations, localized content completion, and real messaging delivery state.

The prototype mixes localized interface labels with some English treatment/table content. Reporting period selection does not consistently recompute every visible financial figure. Treat those values as illustrative. The System Foundations panel also displays some original values that no longer match the refinement; `designtokens.md` records the effective CSS.
