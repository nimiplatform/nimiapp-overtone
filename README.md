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

## Windows package and release

The production target is Windows x86_64 using Desktop-supervised Electron.
Build and inspect the package from this repository:

```bash
pnpm run sync
pnpm exec nimi-app check --production
pnpm exec nimi-app test
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

Before tagging, follow the [GitHub release setup guide](https://github.com/nimiplatform/nimi/blob/main/app-tools/README.md#publishing-on-github), including the `NIMI_REPOSITORY_ADMIN_TOKEN` Actions secret.
A protected annotated version tag on the repository default branch runs the managed build, provenance and immutable Release workflow.
The publisher then submits the immutable Release to [Nimi App Registry](https://github.com/nimiplatform/nimi-app-registry). Registry admission is a separate human review; local builds and GitHub Releases do not create admission or installed state.
