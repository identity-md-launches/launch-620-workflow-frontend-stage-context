# Swarm Spark frontend validation

## Scope and decisions

Complete for the stated **authorized frontend scope**, with the path exception and verification limits below. This is a worker report, not independent network certification. Source is `web/`, the production export is root `dist/`, and evidence is `docs/frontend/`. No publication, redeployment, signing or paid action was performed.

The supplied workflow calls for an unofficial community hackathon registry on Sepolia. Swarm Spark retains the contract-stage name and published prize split `PRIZE_SPLIT 1=5 2=3 3=2`. HACK has no role in entry, judging or prizes; no trading or approval flow was added. The required pool key remains in the runtime manifest unchanged. The source ABIs come from the exact handoff commit, not a generic ABI package.

Only `web/**`, `dist/**`, `docs/**` and the explicit `web/.gitignore` allowance are used. The request for root `DESIGN.md` conflicts with that path budget: the complete design document is instead at `web/DESIGN.md`. `web/README.md` contains install, preview, rebuild, publish instructions, the full experiment banner and exact prize-split line. Protected root files, contracts, Foundry configuration and `lib/` remain untouched.

All six core domains of the supplied Better Interface reference were read before implementation, followed by the relevant keyboard/forms/contrast guidance and documentation method. The supplied browser MCP reported its Chrome executable missing at `/home/seat/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome`. To stay within the write scope, Chromium was installed under `/tmp/swarm-spark-browsers` and a bounded foreground Playwright script served the actual export at `/preview/`, exercised it and closed the server/browser. This was a real rendered-browser check, not a source-only substitution.

## Actual commands and outcomes

Executed from the repository root with Node 24.9.0 and npm 11.6.0:

| Command | Result |
| --- | --- |
| `npm install --prefix web --cache /tmp/swarm-spark-npm --no-audit --no-fund` | Exit 0; normal frontend dependencies installed; source lockfile retained. |
| `npm --prefix web run typecheck` | Exit 0 after final source changes; strict TypeScript, no emit. |
| `npm --prefix web run build` | Exit 0 after final changes; Vite production export followed by manifest generation. Both canonical ABI Keccak hashes matched. |
| `npm --prefix web run verify -- --rpc` | Exit 0; exact schema/handoff/network/pool/contract set, pinned ABI bytes, relative paths, every asset SHA-256 and configured-RPC checks. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/swarm-spark-browsers npm exec --prefix web -- playwright install chromium` | Exit 0; browser installed outside submission. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/swarm-spark-browsers npm --prefix web test` | Exit 0; 31 named checks passed; JSON report and real screenshots generated. |
| `cmp .imd/reads/deployment.json web/deployment/handoff.json` and equivalent network comparison | Exit 0; preserved inputs match their provided originals byte-for-byte. |

Detailed final browser run time, live block and all 31 check names are in [interaction-results.json](interaction-results.json). The live browser loaded its configuration, both ABIs, scripts and styles successfully from the export under a subpath. It recorded **zero console errors, zero failed requests and zero detected axe WCAG A/AA violations** in the scanned state.

Read-only RPC verification used the first configured endpoint, `https://ethereum-sepolia-rpc.publicnode.com`. It returned chain ID **11155111**, LaunchToken code of **1709 bytes**, and HackathonRegistry code of **3567 bytes**. The on-chain deadline was **1792176612**, or **2026-10-16 18:50:12 UTC**; there were **0 historical entries** at the live read. The site displays actual chain data; demo projects exist only in the intercepted test contexts. Nonempty bytecode is a presence check, not an independent proof that deployed bytecode matches source.

## Useful interaction coverage

The test runner serves the finished `dist/`; it does not use the Vite development server. It first uses live RPC with no wallet and then intercepts RPC only in separate deterministic contexts. The injected EIP-1193 wallet returns simulated transaction hashes/receipts; no private key exists in the tests.

- Navigation by hash, keyboard skip link/main focus, FAQ expansion, all 19 toolkit cards, toolkit search/empty/reset and missing-wallet recovery.
- Connection rejection; wrong chain disables registration; switching to Sepolia unlocks it; account and chain events reset ownership/disable writes; local disconnect.
- Required fields, multibyte name limit, safe URL validation and nonzero toolkit selection; first-invalid-field focus; failed requests retain draft inputs.
- Register with the exact manifest target and implementation ABI, no ETH value, receipt confirmation and list refresh; update own entry; reverted receipt does not report success.
- Withdrawal confirmation entered by keyboard, initial focus on the non-destructive action, Escape cancellation/focus return, exact-deadline closure of edits, withdrawal still available after deadline, permanent withdrawn state.
- Historical entry display, active/withdrawn filter, page-local search/reset, pagination over 14 fixture records in pages of 12, unsafe URL suppression and literal rendering of hostile markup.
- Supplied organiser exclusion; empty contract code, wrong RPC chain and altered ABI disable actions; unavailable RPC exposes recovery and retry succeeds.
- Horizontal reflow at 1440, 800, 390 and 320 CSS pixels; 200% root text enlargement at 1440px; reduced-motion setting removes transitions; axe scan and console/network collection.

The tests do not run on the immutable CID or named hosted site, which do not exist as worker prerequisites. Post-publication checks belong to the control plane.

## Better Interface: six-domain review

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native links/buttons/fields/checkboxes/select/dialog/details, headings/landmarks/labels, first-error focus, persistent status/error text, keyboard skip/confirmation paths, visible focus screenshots, minimum touch-height labels, reduced motion, automated axe scan. | No screen-reader session, exhaustive keyboard-only completion of every field, forced-colors visual session or physical touch test. Axe is not full compliance certification. |
| Layout — Checked | Actual screenshots and overflow assertions at 1440, 800, 390 and 320px. Major grids stack, controls remain inset, long addresses wrap. 200% root-font enlargement at desktop. | Native browser 200% zoom, translated strings, RTL and every intermediate width not verified. English/light theme only. |
| Writing — Checked | Entry verbs and error recovery, permanent-withdrawal consequence, current-block vs empty/error distinction, unofficial/experimental status, EOA/mainnet prize address, no HACK requirement, explicit unverified toolkit readiness and custody. | Future judging/payout outcomes and external toolkit content are not certified. |
| Typography — Checked | Source scale and system-font stacks; rendered headings, form byte counters, long metadata and mobile wraps; tabular countdown. No external font resources. | Exact platform font faces/weights outside Chromium/Linux may differ; no other locale/font fallback session. |
| Colors — Checked | Semantic source palette plus measured computed foreground/background pairs; solid surfaces; errors/status have text; keyboard ring visually inspected on skip link and modal. | Not all hover/disabled/forced-color combinations measured; no dark theme is implemented or required. |
| UI — Checked | Button states, empty/loading/error/confirmed/reverted states, native disclosure, modal backdrop/focus, form disabled explanations, captured responsive surfaces; motion under reduced preference. | Wallet extension UI, replacement/repricing, timeout duration and add-chain/EIP-6963 branches received source review but no dedicated browser scenario. No slow-motion panel review. |

Measured final solid pairs (WCAG 2 luminance calculation from browser-computed styles): body/page **14.25:1**; banner copy/subtle **5.41:1**; muted/surface **6.25:1**; primary ink/lime **12.39:1**; dark-panel/footer supporting text **10.48:1**; error/error background **6.34:1**. The precise selectors and RGB values are in the JSON report. These values are not estimates or a blanket accessibility claim.

## Findings, corrections and rechecks

| Severity / domains | Source | Evidence and correction | Recheck |
| --- | --- | --- | --- |
| Medium / Accessibility, writing | `web/src/App.tsx:490` | The initial browser test could not resolve the status filter by its exact label because the wrapping label included select option text. Replaced it with an explicit native `label[for=entry-status]` and matching select ID. | Label-based selection, withdrawn filtering, empty state, reset and pagination all passed. |
| Medium / UI, accessibility | `web/src/styles.css:257` | The element screenshot of the scrolled mobile form exposed an inactive skip link positioned above the viewport. Added clipping and 1px dimensions while unfocused, preserving the focused presentation. | New mobile form image has no overlay. Keyboard skip navigation still passes; focused link image shows its ring. |
| Medium / Writing, UI | `web/src/EntryForm.tsx:151` | The reverted-receipt screenshot said “Receipt not confirmed here” even though a reverted receipt had been read. Track whether a receipt was observed and reserve uncertainty wording for a genuinely unconfirmed receipt. | Reverted-receipt check passes; the final dialog screenshot shows the corrected error text behind the modal. |
| Medium / UI, state integrity | `web/src/EntryForm.tsx:37`, `web/src/App.tsx:419` | Source review found that keying the form by newly assigned entry ID would discard its confirmation/hash after registration. Keep the workspace keyed by account and populate fields when the own-entry ID first loads. | Confirmed registration status remains visible while the own-entry update action and registry card refresh. Account-change test clears prior ownership. |
| Low / UI | `web/src/wallet.ts:43` | Source review found that StrictMode’s setup replay could append the fallback provider twice. Deduplicate the fallback by provider ID. | Wallet connection scenarios and console collection pass without duplicate-key errors. |

No known required interaction defect remains in the checked scope. Known limitations are disclosed above rather than treated as passes.

## Screenshot record

These are actual final-export captures, not mockups. The desktop live page has an empty registry; mock transaction scenarios are explicitly separate.

- [Desktop, 1440px](desktop.jpg): full live page, closed FAQ, default state.
- [Keyboard focus](keyboard-focus.jpg): focused skip link on desktop.
- [800px layout](viewport-800.jpg), [390px mobile](viewport-390.jpg), [320px reflow](viewport-320.jpg): live page after missing-wallet recovery and one expanded FAQ.
- [320px form](mobile-form.jpg): single-column toolkit choices and inset controls; final skip-link fix.
- [Withdrawal dialog](withdraw-dialog.jpg): simulated own entry, native modal, visible keyboard focus, corrected reverted-receipt message behind the overlay.

Desktop/320px hero, full desktop hierarchy, focused skip link, final mobile form and final confirmation dialog were visually inspected. Other full-page captures support the automated width checks; they do not imply a physical-device or screen-reader session.

## Export and submission integrity

The final export includes HTML, bundled CSS/JavaScript, both ABI JSON files and production dependency notices. `imd-deployment.json` is generated last and excludes itself from its asset list. The exact network and wallet-add-chain objects are preserved, as is the entire pool key. Both pinned ABI hashes matched:

- LaunchToken: `38880b8e56d42ce900f744a7908c7139632a49f1c3f33385c64ceaed29d37bee`
- HackathonRegistry: `026d0be5b6a660fb5e233874455fbd5f9d09ee4a9234caffd0757ea02bb2c7ca`

The export is below 1 MiB, with fewer than 128 assets and no individual asset near 8 MiB; immutable plus named HTTP copies have substantial headroom under the 64 MiB response-body budget. Source, required export assets, lockfile and evidence remain complete. No dependency directory, package-manager cache, npm archive, registry mirror or Git submodule is part of the candidate submission. Packaging measurements and scope assertions are recorded in `PACKAGE-CHECK.json`.

Design and documentation attribution: Jakub Krehel’s Better Interface (MIT, pinned `267330e1adfc66a718fb65fa6918c1f06d0a689e`) and Paul Bakaus’s Impeccable documentation method (Apache-2.0, pinned `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). The supplied notices/licenses are retained locally.
