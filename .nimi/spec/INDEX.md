# Overtone Spec Index

Overtone product authority is organized by active domain. Kernel markdown
files and typed tables under each domain carry product semantics;
top-level domain files are reading guides.

## Active Product Domains

- `overtone`

## Reading Order

1. Open `overtone/index.md` for the domain reading guide.
2. Open `overtone/kernel/index.md` for the authority map.
3. Open the relevant `overtone/kernel/*.md` contract for normative rules,
   then the matching `overtone/kernel/tables/*.yaml` if your change is
   table-shaped.
4. Update the implementation under `src/overtone/**` and the contract
   tests under `test/**` in the same change.

## Authority Rules

- `.nimi/spec/**` is the only normative source of Overtone product
  authority.
- `.nimi/{methodology,contracts,config}/**` is the nimicoding governance
  projection — owned by `@nimiplatform/nimi-coding`, managed via
  `pnpm nimicoding sync`, never hand-edited.
- `.nimi/local/**` and `.nimi/cache/**` are local-only operational
  artifacts; they do not promote to product truth.
- `.nimi/admission/**` and `ADMISSION.md` are developer-submitted listing
  inputs; final admission, release descriptors, install availability, and
  permission grants are platform-owned after review.
- `.nimi/app-scaffold/**` is `nimi-app` tooling intent / lock, not
  product authority.
