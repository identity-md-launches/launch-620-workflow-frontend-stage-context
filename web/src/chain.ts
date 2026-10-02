import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  isAddress,
  type Abi,
  type Address,
} from "viem";
import { abiHash, localPath } from "./integrity";
export type Deployment = {
  version: number;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: string;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  assets: { path: string; sha256: string }[];
  poolKey?: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  network: {
    chainId: number;
    name: string;
    testnet: boolean;
    rpcUrls: string[];
    explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    faucets: string[];
  };
  walletAddChain?: {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };
};
export type Entry = {
  id: bigint;
  entrant: Address;
  projectName: string;
  repositoryUrl: string;
  demoUrl: string;
  toolkitMask: bigint;
  withdrawn: boolean;
};
export const PAGE_SIZE = 12n;
export async function loadRuntime() {
  const response = await fetch("./imd-deployment.json", { cache: "no-cache" });
  if (!response.ok)
    throw Error(
      "Deployment configuration is unavailable. Reload to try again.",
    );
  const config = (await response.json()) as Deployment;
  if (
    config.version !== 1 ||
    config.network?.chainId !== config.chainId ||
    !config.network.rpcUrls.length ||
    config.contracts.length !== 2
  )
    throw Error(
      "Deployment configuration is invalid. Transactions are disabled.",
    );
  const abis = new Map<string, Abi>();
  for (const c of config.contracts) {
    if (!isAddress(c.address) || !localPath(c.abiPath))
      throw Error("Invalid contract address or ABI path.");
    const result = await fetch(`./${c.abiPath}`);
    if (!result.ok)
      throw Error(`Unable to load the ${c.name} ABI. Reload to try again.`);
    const abi = (await result.json()) as Abi;
    if (!Array.isArray(abi) || abiHash(abi) !== c.abiHash)
      throw Error(
        `${c.name} ABI verification failed. Transactions are disabled.`,
      );
    abis.set(c.name, abi);
  }
  const registry = config.contracts.find((c) => c.name === "HackathonRegistry");
  if (!registry || !abis.has("LaunchToken"))
    throw Error("Required contracts are missing.");
  const chain = defineChain({
    id: config.chainId,
    name: config.network.name,
    nativeCurrency: config.network.nativeCurrency,
    rpcUrls: { default: { http: config.network.rpcUrls } },
    blockExplorers: {
      default: { name: "Explorer", url: config.network.explorer },
    },
    testnet: config.network.testnet,
  });
  const client = createPublicClient({
    chain,
    transport: fallback(
      config.network.rpcUrls.map((url) =>
        http(url, { timeout: 8000, retryCount: 0 }),
      ),
      { rank: false, retryCount: 0 },
    ),
  });
  const contract = {
    address: registry.address,
    abi: abis.get("HackathonRegistry")!,
  };
  return { config, chain, client, contract, abis };
}
export type Runtime = Awaited<ReturnType<typeof loadRuntime>>;
export async function verifyChain(r: Runtime) {
  if ((await r.client.getChainId()) !== r.config.chainId)
    throw Error("RPC returned the wrong network. Transactions are disabled.");
  const codes = await Promise.all(
    r.config.contracts.map((c) => r.client.getBytecode({ address: c.address })),
  );
  if (codes.some((code) => !code || code === "0x"))
    throw Error(
      "Deployed contract code is missing. Transactions are disabled.",
    );
}
export async function readSnapshot(r: Runtime, account?: Address, page = 0) {
  const block = await r.client.getBlock();
  const read = (functionName: string, args?: readonly unknown[]) =>
    r.client.readContract({
      ...r.contract,
      functionName,
      args,
      blockNumber: block.number,
    });
  const [deadline, count, organiser, ownId] = await Promise.all([
    read("deadline") as Promise<bigint>,
    read("entryCount") as Promise<bigint>,
    read("ORGANISER") as Promise<Address>,
    account
      ? (read("entryIdOf", [account]) as Promise<bigint>)
      : Promise.resolve(0n),
  ]);
  const start = BigInt(page) * PAGE_SIZE + 1n;
  const ids = Array.from(
    {
      length: Number(
        count < start
          ? 0n
          : count - start + 1n < PAGE_SIZE
            ? count - start + 1n
            : PAGE_SIZE,
      ),
    },
    (_, i) => start + BigInt(i),
  );
  const getEntry = async (id: bigint) => ({
    ...((await read("getEntry", [id])) as Omit<Entry, "id">),
    id,
  });
  const [entries, own] = await Promise.all([
    Promise.all(ids.map(getEntry)),
    ownId ? getEntry(ownId) : undefined,
  ]);
  return {
    deadline,
    count,
    organiser,
    entries,
    own,
    block: block.number,
    timestamp: Number(block.timestamp),
    readAt: Date.now(),
  };
}
export type Snapshot = Awaited<ReturnType<typeof readSnapshot>>;
export function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export const byteLength = (value: string) =>
  new TextEncoder().encode(value).length;
export type Fields = {
  projectName: string;
  repositoryUrl: string;
  demoUrl: string;
  toolkitMask: bigint;
};
export function validateFields(fields: Fields) {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!fields.projectName.trim() || byteLength(fields.projectName) > 64)
    errors.projectName = "Enter a project name between 1 and 64 UTF-8 bytes.";
  for (const key of ["repositoryUrl", "demoUrl"] as const)
    if (!safeUrl(fields[key]) || byteLength(fields[key]) > 200)
      errors[key] =
        "Use a public HTTP or HTTPS URL, up to 200 UTF-8 bytes, without embedded credentials.";
  if (fields.toolkitMask < 1n || fields.toolkitMask > 524287n)
    errors.toolkitMask = "Select at least one toolkit item.";
  return errors;
}
export function errorMessage(error: unknown): string {
  const e = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: unknown;
  };
  const raw = e.shortMessage || e.message || "Unknown error";
  if (e.code === 4001 || /rejected|denied/i.test(raw))
    return "Wallet request declined. Nothing was submitted. You can try again.";
  if (/RegistrationClosed/.test(raw))
    return "The deadline has passed. Registration and updates are closed.";
  if (/AlreadyRegistered|EntryAlreadyWithdrawn/.test(raw))
    return "This wallet already has a permanent entry ID. Refresh the registry to see its status.";
  if (/OrganiserIneligible/.test(raw))
    return "Organiser wallets are not eligible to enter.";
  if (/insufficient funds/i.test(raw))
    return "Not enough Sepolia ETH for gas. Use a linked faucet, then try again.";
  return raw.length > 260
    ? raw.slice(0, 260) + "… Check the explorer or retry."
    : raw;
}
