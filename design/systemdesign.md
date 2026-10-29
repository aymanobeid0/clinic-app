# Application component design pointers

The owner-approved [design guide](design.md) governs visual hierarchy, composition, reusable UI and visual review. [Token roles](designtokens.md) map the current Clinic Visual Language package to runtime exports.

Technical boundaries and browser-state ownership are defined by [application architecture](../docs/architecture/application-architecture.md); approved libraries and Radix Primitives adoption by [dependency decisions](../docs/planning/dependency-proposal.md). Components render state/emit actions, pages compose them and routing selects pages. Keep business/query/form orchestration in its existing feature interfaces.

The prior prototype runtime description is retired as an implementation reference. Its earlier text is available in Git history; the retained prototype HTML/images are historical, not an application blueprint. This pointer replaces obsolete prototype-specific layout/library instructions without changing product contracts or retiring the verification scaffold (#76).
