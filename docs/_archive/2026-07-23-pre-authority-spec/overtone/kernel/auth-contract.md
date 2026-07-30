# Overtone Auth Contract

Rule family: `OVT-AUTH-*`. Runtime account session, caller identity,
and token-custody prohibitions for Overtone.

## OVT-AUTH-01 — Runtime account caller

Overtone is a non-first-party `developer-registered-local-app`
runtime-account caller.
The caller identity is fixed and authoritative; concrete values live in
[`tables/runtime-account-caller.yaml`](tables/runtime-account-caller.yaml).

The renderer MUST pass the caller exactly as declared on every
`runtime.account.*` call. Diverging fields (any other `mode`, mismatched
`appInstanceId`) MUST fail-close at the call site.

## OVT-AUTH-02 — Platform client construction

The renderer MUST construct the platform client through the SDK runtime
account/app-session helpers:

- `createNimiDeveloperRegisteredRuntimeAccountCaller(...)`
- `createNimiRuntimeFullAppRegistration(...)`
- `createNimiRuntimeAppSessionMetadataProvider(...)`

Realm bearer-token transport is forbidden for Overtone. Runtime shared auth
means Runtime account custody, login broker, app-session metadata, and scoped
protected access metadata; it does not expose raw Realm access tokens to
developer-registered local apps.

Direct construction via `createPlatformClient(...)` from the Overtone
bootstrap is forbidden. The scaffold-managed
`src/shell/auth/runtime-platform.ts` is the only file allowed to wire
these helpers together.

## OVT-AUTH-03 — App-owned token custody forbidden

App-owned access-token, refresh-token, subject-user-id provider, and
session-store custody are forbidden in the Overtone renderer and Tauri
shell. Runtime is the sole owner of token material; the renderer may
project the authenticated runtime account id only as non-secret session
state. This rule is
enforced at four layers:

1. **SDK helper level.** Runtime app-session and protected access metadata
   are minted by SDK/runtime helpers, never by app-owned token inputs.
2. **Auth adapter.** The `AuthPlatformAdapter` exposed to
   `<DesktopShellAuthPage>` MUST fail-close on `applyToken`,
   `persistSession`, and any oauth/password embedded login path.
3. **Renderer state.** No `authToken`, `authRefreshToken`,
   `subjectUserIdProvider`, `sessionCookie`, access-token, or refresh-token
   fields in any renderer store.
4. **Dev shortcut env.** Reading `VITE_NIMI_REALM_ACCESS_TOKEN` (or any
   other bearer-token env shortcut) from the renderer is forbidden.

## OVT-AUTH-04 — Desktop browser auth

User login MUST drive through the kit `<DesktopShellAuthPage>`
desktop-browser flow, wired to a runtime account broker:

- `broker.begin` → `runtime.account.beginLogin({ caller, redirectUri,
  callbackOrigin, requestedScopes, ttlSeconds })`.
- The realm OAuth authorize URL returned by runtime carries a PKCE S256
  challenge bound to a runtime-held verifier. Overtone never observes
  the verifier.
- User authorizes in the system browser; the realm authorize endpoint
  302-redirects to the Overtone desktop loopback `redirect_uri` with a
  raw OAuth `code`.
- `broker.complete` → `runtime.account.completeLogin({ caller,
  loginAttemptId, code, refreshToken: '', state, nonce, redirectUri,
  callbackOrigin, uxTraceId: '', sealedCompletionTicket: '' })`.

`refreshToken` MUST be the empty string at the wire level; runtime
fail-closes any non-empty value with `PROOF_UNSUPPORTED`.

## OVT-AUTH-05 — Session status

Session status MUST be resolved through
`runtime.account.getAccountSessionStatus({ caller })`. The renderer MUST
treat:

- `AUTHENTICATED` + non-empty `accountProjection.accountId` → ready
  session.
- `AUTHENTICATED` + empty `accountId` → unauthenticated.
- Any other state → unauthenticated.

A renderer that infers an authenticated session from cached state, env
overrides, or an absent error response is a contract violation.

## OVT-AUTH-06 — Account control

Overtone MUST NOT call `runtime.account.logout`, `runtime.account.switchAccount`,
or `runtime.account.getAccessToken`. Those account-control and raw-token
surfaces are reserved for true first-party callers. Overtone MUST NOT call any
kit shared desktop auth-session bridge
(`auth_session_load/save/clear`, `persistSharedDesktopAuthSession`,
`resolveDesktopBootstrapAuthSession`); none is admitted on the Overtone
surface, and the scaffold-managed Tauri shell MUST NOT register the
`auth_session_*` Tauri IPC handlers.

## OVT-AUTH-07 — No dev-standalone bypass

Dev-standalone mode (`VITE_NIMI_APP_AUTH_MODE=dev-standalone`) is not
admitted. Local development MUST use the developer-registered Runtime
account path, with Desktop Developer Mode enabling Runtime
developer-registration for not-yet-reviewed local builds. The renderer MUST
ignore developer-session env credentials and MUST NOT synthesize developer
session credentials or self-open the Runtime developer-registration gate.

## OVT-AUTH-08 — Auth UI consumption

The auth screen is `@nimiplatform/kit/auth#DesktopShellAuthPage`. The
renderer MUST NOT build a parallel login form, OTP code entry surface,
or password reset surface. The kit `<DesktopShellAuthPage>` is the only
admitted auth UI surface (see `OVT-KIT-*`).
