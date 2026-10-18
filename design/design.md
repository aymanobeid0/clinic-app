# Dentara design specification

Source: `design/dentara-refined.html`, reviewed 10 October 2026. This document describes the supplied prototype, with the final `dentara-refinement` stylesheet taking precedence over earlier styles. Browser inspection was attempted but local `file://` navigation was blocked by Browser security; visual behavior is inferred from source, not screenshot verified.

## Product direction

Dentara is a bilingual dental clinic workspace for a team in Nouakchott, Mauritania. Its visual promise is “A quiet system for busy clinics”: readable clinical information, white surfaces, precise typography, and meaningful color. Currency is Mauritanian ouguiya (MRU). All patient and financial records in this reference are fictional demo data.

Use a pale gray workspace, white bordered cards, deep navy text, and restrained indigo actions. Separate information through spacing and thin dividers. Reserve shadows for floating surfaces. Initial avatars are deliberate identity fallbacks. Avoid decorative imagery and excessive color in operational views.

## Application shell

- Fixed sidebar: Dentara wordmark, clinic identity, grouped navigation, sync indicator, settings, and signed-in clinician identity.
- Desktop sidebar is 232px wide; workspace offset matches it. Header is 76px high with 36px horizontal padding.
- Header contains current section, clinic breadcrumb, language toggle, and notification action.
- Main content is centered within a 1560px maximum width with 36px padding.
- Page heading pairs a prominent title and short explanation with New appointment. Settings omits that action. The refinement hides eyebrow text.
- Footer contains the product signature and design system version 1.1.

## Screen composition

| Screen | Structure and behavior |
| --- | --- |
| Dashboard | Overview/Clinical/Financial selector, period and export controls; four-cell metric strip; revenue chart and direct-cost summary; appointment table; popular treatments and reminder panel. |
| Patients | Searchable, status-filtered patient/appointment table with detail dialog. This is a compact demo listing, not a complete longitudinal patient record. |
| Appointments | Calendar with date navigation, view selection, doctor filtering, event details, and appointment creation entry points. |
| Profitability | Summary metrics and chart followed by treatment-level revenue, direct costs, contribution, and margin table. |
| Inventory | Read-only materials table with SKU, quantity, reorder threshold, unit cost, and availability status. |
| System | Foundations, Components, and Patterns tabs demonstrating the visual language and intended clinical conventions. |
| Settings | Interface language selector and read-only MRU currency field; preferences are prototype state. |

The desktop dashboard uses a `1.8fr / minmax(300px, 1fr)` chart-and-cost grid with 24px gaps. The lower grid inherits `1.25fr / 1fr`. Metrics form one bordered white strip with internal dividers, rather than four detached cards.

## Information hierarchy

Page titles are 32px/40px, weight 600. Section titles are 17px with 1.45 line height. Metric values are 32px with tabular numerals. Supporting prose uses 13–14px; table data uses 13px; labels, badges, and metadata use 11–12px. Use muted text for context while keeping clinical identity and totals prominent.

Tables place patient name and ID together beside a 38px avatar. Columns then show time, treatment, clinician, status, balance, and detail action. Header backgrounds are lightly tinted; rows use subtle bottom borders and an indigo-tinted hover. Preserve columns through horizontal scrolling on narrow screens.

## Primary flows

1. Create appointment: open dialog, enter name/date/doctor/time/treatment, submit, append a Pending record with zero balance, close dialog, and show success feedback. Changes exist only in the current session.
2. Review patient: open from name or row action, inspect identity and appointment details, change appointment status, and receive a toast. A reminder action opens message previews.
3. Find a record: search English name, Arabic name, or patient ID; combine with status filter. Empty results include explanation and Clear filters.
4. Review reminders: open from notification or dashboard panel; inspect two eligible sample messages. Preview actions do not send WhatsApp messages.
5. Export: download the demo CSV report. The source exports all records, not only the visible filtered subset.

## Responsive and bilingual behavior

At 1200px and below, main/header padding reduces to 28px and panel spacing tightens. At 1050px and below, metrics become two columns and major grids stack; the cost card remains visible. At 720px and below, the sidebar is hidden behind the menu toggle, opening at 252px wide below the sticky 64px header. Main padding becomes 24px 16px, the primary page action spans the width, toolbar controls wrap, and appointment form fields stack. At 380px and below, metric values shrink and treatment progress bars disappear.

English uses Inter; Arabic uses Noto Sans Arabic. Toggle document language and direction together. Mirror navigation and directional arrows using logical CSS properties. Keep charts, IDs, times, and numeric/currency groups isolated from surrounding RTL flow. Arabic headings remove letter spacing and receive more generous line height.

## Accessibility and trust

Use explicit labels, semantic tables, labeled icon buttons, visible keyboard focus, and status text alongside color. Dialogs have a named modal role, focus containment, Escape dismissal, and focus restoration. Toasts use `role="status"` and last 3500ms. Reduced-motion styles disable transitions and animations.

Differentiate treatment revenue from cash collection. Contribution equals treatment revenue minus direct costs; it excludes overheads and tax and must not be called net profit. Treat the displayed sync status as demo presentation, not evidence of a sync service. Full clinical history, permissions, dental charting, and delivery-confirmed messaging are documented intentions rather than implemented capabilities.

See `systemdesign.md` for component and runtime structure and `designtokens.md` for effective values.
