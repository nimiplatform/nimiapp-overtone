# Nimi Overtone

Profile: `standalone`

This repository is a Nimi App authoring scaffold. `nimi.app.yaml`, the build profile, App Access declaration, pack output, validate output, and local audit output are submitted inputs and pre-submission self-checks only.

## Development

```bash
pnpm install
pnpm dev -- --cdp-port 19507
pnpm run validate
pnpm run local-audit
pnpm run pack
pnpm run doctor
```

`pnpm dev` asks the running Nimi Desktop supervisor to build the Electron main/preload, start the Vite renderer on `127.0.0.1:1507`, and launch the protected Local App carrier. Use `pnpm dev -- --cdp-port <port>` for loopback CDP inspection.

The renderer uses the host-injected `NimiLocalAppClient` session. It does not own login, caller identity, tokens, connector bindings, or a generic Runtime transport. The current App Access contract admits text candidates but not music jobs, so music generation and iteration fail closed as explicitly unavailable instead of using the retired direct Runtime path.

`doctor` is a developer source check. It does not update an installed app, publish admission truth, create release descriptors, or grant App Access.

For Nimi listing review, keep `nimi.app.yaml`, `.nimi/admission/submission.yaml`, `.nimi/admission/build-profile.yaml`, and `ADMISSION.md` in sync with the product behavior under `src/shell/routes/product-area.tsx`.

Upstream Platform/Runtime review produces release descriptors, ordinary visibility, install truth, and App Access authorization. This scaffold does not mint those outcomes.
