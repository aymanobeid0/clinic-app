# Approved design tokens

Owner-approved appearance source: `D:/clinic-visual-system/tokens.json`, Clinic Visual Language1.0.0. Read [the application guide](design.md) for composition, spacing roles, workflow and exceptions.

## Sources and synchronization

- In-repository snapshot: [tokens.json](../apps/web/src/workspace/tokens.json).
- Runtime convenience export: [tokens.css](../apps/web/src/workspace/tokens.css), currently imported by workspace.css.
- External specimens: `D:/clinic-visual-system/index.html` and `screenshots/`. They show components, not application-page geometry.
- Font files/licenses: [workspace assets](../apps/web/src/workspace/assets/).

Resolve `color.*` recipes from the selected theme, other paths from foundation, using each token's value. A token change must update its approved JSON, runtime snapshot/export and affected specimens together; verify semantic equality rather than byte equality after formatting. If the approved external package is unavailable, report that limitation and use the in-repository snapshot for unchanged approved values; do not invent new source values. Read the external package when changing identity/tokens.

## Semantic mapping

| Purpose | Runtime variable / value |
| --- | --- |
| Canvas and content | --color-canvas, --color-surface, --color-surface-subtle, --color-surface-inset |
| Primary and supporting text | --color-text, --color-text-secondary, --color-text-muted |
| Main action | --color-primary / --color-on-primary, with --color-primary-hover |
| Accent | --color-accent / --color-on-accent |
| Selection and focus | --color-selected-surface/text, --color-focus |
| Meaningful status | --status-success/danger/warning and their matching surfaces |
| Borders | --color-border, --color-border-strong; content-card border omitted by owner direction |
| Shape | --radius-control (12px), --radius-card (20px), --radius-feature (28px), --radius-pill |
| Spacing | --space-* from the existing scale; application role defaults in design.md |
| Type | --font-body (Inter), --font-editorial (Instrument Serif), --font-size-*, --line-height-* |

Blue is default; `data-theme="teal"` selects the alternative. Values come from the linked export, not this summary. No additional dark palette, per-page brand colors or specimen documentation CSS is selected. Former prototype token values are retired and recoverable in Git history.
