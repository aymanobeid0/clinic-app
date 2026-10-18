# Dentara design tokens

Source: `design/dentara-refined.html`. Values below follow the final CSS cascade, including `dentara-refinement`. CSS variables are existing tokens; named dimensions below are documented component values, not additional variables already present in the source. Browser-computed styles were not inspected.

## Existing root tokens

| CSS token | Effective value | Use |
| --- | --- | --- |
| `--brand` | `#4657e8` | Primary actions, selection, chart emphasis, focus. |
| `--brand-hover` | `#3544c9` | Primary hover. |
| `--brand-soft` | `#eef0ff` | Active navigation, segmented selection, contribution surface. |
| `--ink` | `#18243d` | Primary text, toast background. |
| `--muted` | `#606d85` | Secondary labels and supporting text. |
| `--canvas` | `#f5f6fa` | Workspace background. |
| `--surface` | `#ffffff` | Controls and cards. |
| `--border` | `#e1e5ed` | Dividers and outlines. |
| `--success` | `#157b61` | Positive/confirmed states. |
| `--success-soft` | `#eaf7f1` | Positive-state surfaces. |
| `--warning` | `#956008` | Pending/low-stock state text. |
| `--warning-soft` | `#fff5dd` | Warning surfaces. |
| `--danger` | `#c43d63` | Errors, overdue/destructive states. |
| `--danger-soft` | `#fff0f4` | Danger surfaces. |
| `--radius` | `14px` | Default card radius. |
| `--space` | `24px`; `20px` at ≤720px | Declared spacing reference; most layout spacing is explicitly set. |
| `--font` | `"Inter", sans-serif` | Default UI family; `.rtl` changes to `"Noto Sans Arabic", sans-serif`. |

## Supporting colors

| Role | Value |
| --- | --- |
| Violet foreground / surface | `#7655b2` / `#f1ecfc` |
| Table header / row hover | `#f8f9fc` / `#f7f8ff` |
| Table row border | `#edf0f5` |
| Reminder card background | `#f8fcfa` |
| Placeholder | `#67748b` |
| Selection background / text | `#dce1ff` / `#18243d` |
| Scrollbar thumb | `#b7bfd1` |
| Overlay | `#18243d66` |
| Progress track / amber fill | `#f0f1f7` / `#e9bd5d` |
| Invalid field background / destructive border | `#fffafb` / `#f5ccd6` |

Semantic helper classes pair text and surface colors: `.mint` = success, `.blue` = brand, `.amber` = warning, `.rose` = danger, `.violet` = violet. Always include a readable state label.

## Typography

Inter embeds weights 400, 500, 600, and 700; Arabic font faces include 400 and 600. Root size is 14px with 1.55 line height and font synthesis disabled.

| Role / selector | Size | Weight | Line height / tracking |
| --- | --- | --- | --- |
| Page title `h1` | 32px | 600 | 1.25 / -0.9px |
| Section title `h2` | 17px | 600 | 1.45 / -0.3px |
| Subheading `h3` | 16px | 600 | 1.5 |
| Brand `.brand` | 27px | 600 | inherited / -0.8px |
| Metric `.metric-value b` | 32px | 600 | 1.2 / -0.9px |
| Chart total | 30px | 600 | inherited / -0.7px |
| Contribution value | 28px | 600 | 1.4 |
| Page description | 14px | 400 | 1.65 |
| Table cell / patient name | 13px | 400 / 600 | inherited |
| Table header | 11px | 500 | inherited / 0.1px |
| Button label | 13px | 500 | inherited |
| Badge | 11px | 500 | 1.4 |
| Dialog title | 24px | 600 | inherited heading rules |
| Dialog field text | 14px | inherited | inherited |
| Notice | 12px | inherited | 1.7 |
| Metadata / footer | 11px | varies | 1.5–1.6 |

Numeric groups use `font-variant-numeric: tabular-nums`, `direction:ltr`, and `unicode-bidi:isolate`. RTL titles remove tracking; RTL `h1` inherits the earlier 1.6 line height. Arabic page descriptions use 1.9 line height. The explicit Arabic typography sample uses 22px/1.65.

## Spacing and geometry

Reference spacing scale: 4, 8, 12, 16, 24, 32px. The refinement also uses 18, 20, 28, 30, 36, and 40px for specific layouts.

| Role | Effective desktop value |
| --- | --- |
| Sidebar / header | 232px width / 76px height |
| Main | max-width 1560px; padding 36px |
| Major panel gap | 24px |
| Card / metric strip radius | 14px |
| Primary/secondary/danger control | min-height 44px; padding 11px 16px; radius 9px |
| Small button | min-height 38px; padding 8px 12px |
| Icon button | 40px square; radius 9px |
| Navigation item | min-height 46px; padding 12px; radius 8px |
| Generic input/select | min-height 40px; padding 8px 12px; radius 8px |
| Dialog input/select | min-height 44px |
| Search | width 320px; min-height 42px; radius 9px |
| Segmented wrapper / item | padding 4px; radius 10px / min-height 34px; radius 6px |
| Badge | padding 4px 8px; radius 6px; gap 6px; dot 5px |
| Avatar | 38px square; circular; detail variant 48px |
| Table header / cell padding | 14px 22px / 18px 22px |
| Dialog | width 520px; radius 16px; padding 28px; max-height 90vh |
| Patient dialog | width 620px |
| Overlay padding | 24px |
| Toast | padding 14px 20px; radius 10px; 24px from bottom/end |
| Progress | height 7px; radius 8px; treatment-list height 5px |

Widths are constrained by available overlay space. At ≤720px, dialog padding is 24px 20px, overlay padding is 12px, and dialog max-height is `calc(100dvh - 24px)`.

## Elevation, motion, and focus

| Role | Value |
| --- | --- |
| Dialog shadow | `0 24px 80px #18243d26` |
| Toast shadow | `0 8px 32px #18243d24` |
| Mobile open sidebar shadow | `8px 16px 36px #18243d20` |
| Overlay blur | `3px` |
| General focus | `2px solid var(--brand)`; offset 4px |
| Search container focus | same 2px outline; offset 3px; child input outline suppressed |
| Calendar link focus | inherited `.fc a:focus-visible`: `3px solid #aab1fb`; offset 1px |
| Button transition | background/color 150ms |
| Table row transition | background 160ms ease |
| Layer order | sidebar 20; mobile header 30; mobile sidebar 40; overlay 50; toast 80 |

Reduced motion disables animation and transition across elements and pseudo-elements and resets smooth scrolling.

## Reuse and discrepancy policy

Prefer the semantic CSS variables above. Supporting literal values are extracted from the reference, not an expanded canonical palette. Resolve color/radius changes centrally before adding new variants.

The embedded Foundations swatches still advertise muted `#68748D`, canvas `#F7F8FC`, and border `#E4E7EF`. Its sample copy also mentions 28px page titles, 12px cards, and 20px dialogs. Those are older reference labels; the effective refined defaults are the values in this document. Responsive and more-specific selectors can override these defaults; see `systemdesign.md` for breakpoint behavior.
