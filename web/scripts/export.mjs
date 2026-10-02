import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { abiHash } from "../src/integrity.ts";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = root + "dist/";
const handoff = JSON.parse(
  await readFile(root + "web/deployment/handoff.json"),
);
const network = JSON.parse(
  await readFile(root + "web/deployment/network.json"),
);
if (handoff.chainId !== network.network.chainId)
  throw Error("Handoff/network chain mismatch");
await mkdir(dist + "abi", { recursive: true });
const contracts = [];
for (const c of handoff.contracts) {
  const path = `docs/abi/${c.name}.json`;
  const pinned = execFileSync(
    "git",
    ["show", `${handoff.sourceCommit}:${path}`],
    { cwd: root },
  );
  const current = await readFile(root + path);
  if (!pinned.equals(current))
    throw Error(`${path} differs from pinned source`);
  const abi = JSON.parse(pinned);
  if (abiHash(abi) !== c.abiHash)
    throw Error(`${c.name}: canonical ABI hash mismatch`);
  const abiPath = `abi/${c.name}.json`;
  await writeFile(dist + abiPath, pinned);
  contracts.push({
    name: c.name,
    address: c.address,
    abiHash: c.abiHash,
    abiPath,
  });
  console.log(`Verified pinned ${c.name} ABI: ${c.abiHash}`);
}
// Retain license texts for installed production dependencies in the static export.
const lock = JSON.parse(await readFile(root + "web/package-lock.json"));
const notices = ["Swarm Spark — production dependency licenses\n"];
for (const [packagePath, info] of Object.entries(lock.packages)) {
  if (!packagePath.startsWith("node_modules/") || info.dev) continue;
  const directory = root + "web/" + packagePath;
  let files;
  try { files = await readdir(directory); } catch { continue; }
  const licenses = files.filter(name => /^licen[cs]e(?:\..*)?$/i.test(name)).sort();
  for (const license of licenses) {
    notices.push(`\n${packagePath} @ ${info.version} — ${license}\n`);
    notices.push(await readFile(directory + "/" + license, "utf8"));
  }
}
await writeFile(dist + "THIRD-PARTY-NOTICES.txt", notices.join("\n"));
const assets = [];
async function enumerate(dir = "") {
  for (const name of (await readdir(dist + dir)).sort()) {
    const path = dir + name;
    if (path === "imd-deployment.json") continue;
    if ((await stat(dist + path)).isDirectory()) await enumerate(path + "/");
    else {
      const bytes = await readFile(dist + path);
      if (bytes.length > 8388608) throw Error(`Asset too large: ${path}`);
      assets.push({
        path,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
}
await enumerate();
if (assets.length > 128) throw Error("Too many assets");
const manifest = {
  version: 1,
  launchId: handoff.launchId,
  chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit,
  attestationHash: handoff.attestationHash,
  contracts,
  assets,
  ...(handoff.poolKey ? { poolKey: handoff.poolKey } : {}),
  network: network.network,
  ...(network.walletAddChain ? { walletAddChain: network.walletAddChain } : {}),
};
await writeFile(
  dist + "imd-deployment.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`Wrote manifest after export: ${assets.length} hashed assets`);
