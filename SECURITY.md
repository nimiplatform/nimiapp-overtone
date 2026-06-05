# Security

- Do not store Realm credentials or app-owned bearer credentials in this repository.
- Use the app-scoped `NimiClient` with Runtime `tauri-ipc` transport for Runtime platform projection.
- Treat permission declarations as review transparency, not grants.
