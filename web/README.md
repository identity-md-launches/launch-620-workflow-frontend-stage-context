# Swarm Spark frontend

> This hackathon and every toolkit item are an experiment and a test of the swarm, may not work as described, entries are judged by AI agents, and no prize is guaranteed if judging fails.

Swarm Spark is a small, unofficial, community-run, just-for-fun 14-day hackathon. It is **not the official IMD hackathon**; the IMD team plans its own separately. The theme is the best working end product built with the experimental toolkit. The site uses its own spark mark and visual identity, without official IMD branding.

PRIZE_SPLIT 1=5 2=3 3=2

First place receives Swarm Pepe #1111 plus 5 IMD; second receives 3 IMD; third receives 2 IMD. The organiser’s off-chain service is responsible for automatic payouts on Ethereum mainnet after successful public judging, to the address used to register on Sepolia. The dedicated prize wallet supplied in the brief is `0x9e134c3dedDb698B81C9E1581925766b62d26400`. This frontend has not independently verified its holdings or payout service. With no eligible entries, nothing is paid; shares for unawarded places are not redistributed. Organiser wallets cannot enter.

## Install, rebuild and preview

Use Node.js **22.18+** (tested with 24.9.0), npm and Git. Native TypeScript stripping is used by the build/verification scripts. Run from the repository root:

```sh
npm ci --prefix web
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web run verify
npm --prefix web run preview -- --port 4173
```

Open the preview address printed by Vite. Edit `web/src/`, rebuild, then reload the preview. `dist/` is the complete production export at repository root. No root build configuration, root lockfile, contract source, vendored Solidity dependency or deployment has been changed. The source dependency lockfile is `web/package-lock.json`.

The build uses Vite/React/TypeScript with `base: './'`, local assets and in-page hash navigation. There is no server API, private credential, external font or runtime CDN dependency. Reading the chain requires a reachable public RPC. Wallet writes require a compatible EIP-1193 browser wallet; EIP-6963 wallet discovery and an injected-provider fallback are supported. WalletConnect/QR connections are not included.

## Deployment and reproducible export

`web/deployment/handoff.json` and `network.json` preserve the supplied public handoff inputs after the worker-only `.imd/reads/` directory is removed. They are build inputs, never imported into the browser bundle. The browser fetches **one** runtime configuration, `./imd-deployment.json`, and loads the ABI JSON referenced there. There is no second runtime address, chain or ABI map.

After Vite finishes, `scripts/export.mjs`:

1. Reads `docs/abi/LaunchToken.json` and `docs/abi/HackathonRegistry.json` from pinned source commit `8f503e6c3411f01581b55d28d715c4b8ef0a79a1` using `git show`, and checks the working-tree ABI bytes match.
2. Canonicalizes ABI JSON by recursively sorting object keys while preserving array order, then compares the Keccak-256 hashes to the handoff. These are the implementation-derived exports from the contract stage; no generic ERC-20 ABI is substituted.
3. Copies the exact ABIs to `dist/abi/`, preserves production dependency licenses in `THIRD-PARTY-NOTICES.txt`, enumerates every exported file except the manifest, and computes lowercase SHA-256 hashes.
4. Writes `dist/imd-deployment.json` last with the exact attested contract set, launch, source, chain and attestation values, plus the unchanged handoff pool key and unchanged network/wallet-add-chain objects. It rejects more than 128 assets or an individual asset larger than 8 MiB.

Keep the pinned commit in the Git history when rebuilding. Do not hand-edit an exported file: change the source and rebuild so the manifest hashes are regenerated. `npm --prefix web run verify` checks exact manifest shape, handoff correspondence, pinned ABI bytes/hashes, path safety, complete asset enumeration and every content hash without RPC access. Add `-- --rpc` to check the configured chain and code as well.

## What works

- On-chain deadline and countdown, using the latest block time plus elapsed local time; chain snapshots refresh every 30 seconds. A stale or failed read disables writes. The timer is an estimate, and inclusion in a block before the immutable deadline is what counts.
- Connect/disconnect locally, choose a discovered wallet, switch to Sepolia or request adding the provided network, and respond to account/chain/disconnect events. Local disconnect does not revoke the wallet extension’s site permission.
- Register once per address; read and edit only the connected wallet’s entry; permanently withdraw at any time, including after the deadline. Withdrawal does not release the entry ID or erase public metadata.
- UTF-8 byte counters and validation (name 1–64, each URL 1–200); HTTP(S)-only URLs without embedded credentials; a nonzero mask over the exact 19 toolkit bits. User metadata is escaped as text and never automatically fetched.
- Preflight RPC chain/code checks, a fresh ownership/deadline read, contract simulation, wallet-account/chain recheck, zero-value writes, pending/submitted/confirmed/error status, explorer links and a post-receipt refresh. One successful receipt is the UI confirmation threshold; this is not a finality guarantee.
- Historical entries in bounded pages of 12 at one block per snapshot; withdrawn status, per-page name/address search and status filters. The connected wallet’s own entry is fetched separately even when it is off-page.
- All 19 toolkit links, toolkit search, faucet links, entry steps, published judging rubric, prizes, eligibility, FAQ, and expandable deployment diagnostics with ABI/config downloads. Toolkit readiness is checked at the linked build pages, not invented or scraped by this site.

Seven agents judge at the deadline using weights of 35% working end product, 25% use of the toolkit, 20% usefulness, 10% quality and 10% originality. Each category is scored 0–5, for `sum(score / 5 * weight)` out of 100. Four of seven must agree on the ordered top three, otherwise a single impartial swarm judge decides. Ties use working-product score, then toolkit score, then lower entry ID. Eligibility decisions, scores and any fallback decision must be public. There are no results to show at delivery.

Swarm Hackathon Token (HACK) has a supply of 1,000,000,000 with 18 decimals and plays no role in entry, judging or prizes. The approved workflow has no swap requirement; this site neither trades HACK nor requests token approvals. The exact launch pool configuration is nevertheless included in the manifest and available in deployment details. Registry writes use Sepolia only; mainnet prize payments are the organiser’s separate responsibility.

## Validation

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/swarm-spark-browsers npm exec --prefix web -- playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/swarm-spark-browsers npm --prefix web test
npm --prefix web run verify -- --rpc
```

The test command starts an ephemeral HTTP server, serves the **production export at `/preview/`**, launches Chromium, and closes both in the same foreground process. It checks the live read-only page first, then intercepts RPC and injects a deterministic wallet for transaction scenarios. Internet access is required for the live portion. Test screenshots and machine-readable results intentionally go to `docs/frontend/`; temporary browser downloads stay outside the repository.

The production build, TypeScript check, manifest verification and **31 browser checks passed**. Checks include desktop/mobile reflow, keyboard focus, filters, FAQs, wallet rejection, wrong-chain switching, validation, registration/edit/withdrawal receipts, account changes, exact-deadline behavior, pagination, hostile metadata, missing code, wrong RPC chain, unavailable RPC/retry and ABI corruption. The tested live page had no console errors, no failed requests and no detected axe WCAG A/AA violations. See [validation evidence](../docs/frontend/VALIDATION.md), [machine-readable results](../docs/frontend/interaction-results.json) and [implemented design](DESIGN.md).

These are worker observations, not independent certification. No actual wallet signing/broadcast, prize payment, full screen-reader session, physical-device session, Safari or Firefox test was performed. The configured tool-managed Chrome was unavailable, so the permitted bounded Playwright process supplied browser validation. Native 200% browser zoom was not tested; 200% root text enlargement and 320px reflow were.

## Publish the existing export

The subsequent publisher should commit/include `web/`, the required `docs/` evidence and the complete root `dist/`, then upload the **contents of `dist/` as one directory** to IPFS and point the site name/ENS contenthash at that directory CID. Its root contains `index.html` and `imd-deployment.json`. Use a secure gateway for wallet access. No rebuild, server rewrite, contract redeployment or frontend secret is required at hosting time.

Do not rename or omit assets, ABIs or the manifest during upload. Confirm both the fixed-CID and named entrypoint serve the same files and hashes. The control plane subsequently checks assets/configuration, attested deployment data, configured chain ID and nonempty contract code; it does not execute browser interactions. Publishing, pinning, ENS updates, public URLs and CIDs are outside this worker delivery and were not performed.

`web/.gitignore` uses the explicit path allowance and excludes nested dependency/cache directories and test-runner outputs; it does not exclude `dist/`. No npm registry mirror, dependency archive or submodule is included. The delivered static export is approximately 0.53 MiB.

## Scope and design references

The root `DESIGN.md` location conflicts with the explicit permitted-path list. The design document is therefore delivered at **`web/DESIGN.md`**, and this README is under `web/`; protected root files remain unchanged.

The six-domain review applied the pinned Better Interface guide, adapted from Jakub Krehel at commit `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT). Design documentation follows the included Impeccable method by Paul Bakaus at `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0). See [licenses](../docs/frontend/DESIGN-LICENSE.txt) and [attribution](../docs/frontend/DESIGN-NOTICE.txt).
