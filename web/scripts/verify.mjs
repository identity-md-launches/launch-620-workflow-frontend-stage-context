import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, fallback } from "viem";
import { abiHash, localPath } from "../src/integrity.ts";
const root = fileURLToPath(new URL("../../", import.meta.url));
const json = async (p) => JSON.parse(await readFile(root + p));
const handoff = await json("web/deployment/handoff.json");
const network = await json("web/deployment/network.json");
const manifest = await json("dist/imd-deployment.json");
assert.deepEqual(
  Object.keys(manifest).sort(),
  [
    "version",
    "launchId",
    "chainId",
    "sourceCommit",
    "attestationHash",
    "contracts",
    "assets",
    "poolKey",
    "network",
    "walletAddChain",
  ].sort(),
);
for (const key of [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
  "poolKey",
])
  assert.deepEqual(manifest[key], handoff[key]);
assert.deepEqual(manifest.network, network.network);
assert.deepEqual(manifest.walletAddChain, network.walletAddChain);
assert.deepEqual(
  manifest.contracts,
  handoff.contracts.map(({ name, address, abiHash }) => ({
    name,
    address,
    abiHash,
    abiPath: `abi/${name}.json`,
  })),
);
for (const c of manifest.contracts) {
  assert(localPath(c.abiPath));
  const abi = await json("dist/" + c.abiPath);
  assert.equal(abiHash(abi), c.abiHash);
  const pinned = execFileSync(
    "git",
    ["show", `${manifest.sourceCommit}:docs/abi/${c.name}.json`],
    { cwd: root },
  );
  assert.equal(
    await readFile(root + "dist/" + c.abiPath, "utf8"),
    pinned.toString(),
  );
}
async function list(path) {
  const all = [];
  for (const name of (await readdir(root + path)).sort()) {
    const next = path + name;
    if ((await stat(root + next)).isDirectory())
      all.push(...(await list(next + "/")));
    else all.push(next);
  }
  return all;
}
const files = (await list("dist/")).filter(
  (p) => p !== "dist/imd-deployment.json",
);
assert.deepEqual(
  manifest.assets.map((a) => "dist/" + a.path).sort(),
  files.sort(),
);
let size = (await stat(root + "dist/imd-deployment.json")).size;
assert(manifest.assets.length <= 128);
for (const a of manifest.assets) {
  assert(localPath(a.path));
  const file = await readFile(root + "dist/" + a.path);
  assert.equal(createHash("sha256").update(file).digest("hex"), a.sha256);
  assert(file.length <= 8388608);
  size += file.length;
}
assert(size < 8 * 1024 * 1024);
console.log(
  `PASS: exact handoff, pinned ABIs, network, poolKey, ${files.length} assets, every SHA-256. Export ${size} bytes.`,
);
if (process.argv.includes("--rpc")) {
  const client = createPublicClient({
    transport: fallback(
      network.network.rpcUrls.map((url) =>
        http(url, { timeout: 10000, retryCount: 0 }),
      ),
      { retryCount: 0 },
    ),
  });
  const chainId = await client.getChainId();
  assert.equal(chainId, manifest.chainId);
  console.log(
    `RPC chain ID ${chainId} verified at ${new Date().toISOString()}`,
  );
  for (const c of manifest.contracts) {
    const code = await client.getBytecode({ address: c.address });
    assert(code && code !== "0x");
    console.log(`${c.name} code: ${(code.length - 2) / 2} bytes`);
  }
  const c = manifest.contracts.find((c) => c.name === "HackathonRegistry");
  const abi = await json("dist/" + c.abiPath);
  const block = await client.getBlock();
  const read = (functionName) =>
    client.readContract({
      address: c.address,
      abi,
      functionName,
      blockNumber: block.number,
    });
  const [deadline, count] = await Promise.all([
    read("deadline"),
    read("entryCount"),
  ]);
  console.log(
    `Snapshot block ${block.number}, chain timestamp ${block.timestamp}, deadline ${deadline} (${new Date(Number(deadline) * 1000).toISOString()}), historical entries ${count}.`,
  );
}
