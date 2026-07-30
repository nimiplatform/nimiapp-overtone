# Overtone Domain Guide

This file is a reading guide. Overtone normative authority lives in
[kernel/index.md](kernel/index.md).

Reading path:

| Document | Role |
|----------|------|
| [kernel/index.md](kernel/index.md) | Overtone kernel authority map (OVT-* rule families) |
| [overtone.md](overtone.md) | Product overview, positioning, root model snapshot |
| [AGENTS.md](AGENTS.md) | Authoring rules for AI agents editing this spec |
| [kernel/product-contract.md](kernel/product-contract.md) | `OVT-PROD-*` invariants |
| [kernel/data-model-contract.md](kernel/data-model-contract.md) | `OVT-DATA-*` entities |
| [kernel/workflow-contract.md](kernel/workflow-contract.md) | `OVT-FLOW-*` Brief → Publish flow |
| [kernel/runtime-integration-contract.md](kernel/runtime-integration-contract.md) | `OVT-RT-*` SDK runtime surfaces |
| [kernel/realm-integration-contract.md](kernel/realm-integration-contract.md) | `OVT-REALM-*` SDK realm surfaces |
| [kernel/auth-contract.md](kernel/auth-contract.md) | `OVT-AUTH-*` runtime-account caller + token custody |
| [kernel/ia-contract.md](kernel/ia-contract.md) | `OVT-IA-*` layout, panels, transport |
| [kernel/kit-ui-consumption-contract.md](kernel/kit-ui-consumption-contract.md) | `OVT-KIT-*` kit allowlist + composition rules |
| [kernel/removed-surfaces-contract.md](kernel/removed-surfaces-contract.md) | `OVT-REMOVED-*` hard removals |
| [kernel/tables/feature-tier-matrix.yaml](kernel/tables/feature-tier-matrix.yaml) | P0/P1/P2 feature register |
| [kernel/tables/runtime-scenario-bindings.yaml](kernel/tables/runtime-scenario-bindings.yaml) | scenario → SDK surface bindings |
| [kernel/tables/runtime-account-caller.yaml](kernel/tables/runtime-account-caller.yaml) | runtime account caller identity |
| [kernel/tables/error-reason-handling.yaml](kernel/tables/error-reason-handling.yaml) | reason-code → app response matrix |
| [kernel/tables/take-origin-catalog.yaml](kernel/tables/take-origin-catalog.yaml) | `SongTake.origin` admitted values |
| [kernel/tables/nimi-kit-allowlists.yaml](kernel/tables/nimi-kit-allowlists.yaml) | admitted kit module imports |
| [kernel/tables/removed-surface-names.yaml](kernel/tables/removed-surface-names.yaml) | hard-removed surface name catalog |

Implementation cross-references live in the project root under
`src/overtone/**` and `test/**`. Every spec change must keep the matching
source modules in sync, or open a dated drift note in the relevant
`kernel/*.md`.
