import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { decodeFunctionData, encodeFunctionResult, toHex } from "viem";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = root + "docs/frontend/";
const manifest = JSON.parse(await readFile(root + "dist/imd-deployment.json"));
const registry = manifest.contracts.find((c) => c.name === "HackathonRegistry");
const abi = JSON.parse(await readFile(root + "dist/" + registry.abiPath));
const reports = {
  date: new Date().toISOString(),
  productionSubpath: "/preview/",
  live: {},
  checks: [],
  screenshots: [],
  limitations: [
    "Wallet transactions are simulated; no funded wallet, signing extension or real transaction was used.",
    "No native screen reader, physical mobile device, Safari, Firefox or browser-native zoom session.",
  ],
};
const mark = (name) => {
  reports.checks.push({ name, result: "pass" });
  console.log("PASS:", name);
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const path = resolve(
      root + "dist",
      pathname.slice("/preview/".length) || "index.html",
    );
    if (!path.startsWith(resolve(root + "dist") + "/"))
      throw Error("Invalid path");
    const bytes = await readFile(path);
    res.writeHead(200, {
      "Content-Type":
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".svg": "image/svg+xml",
        }[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await chromium.launch({ headless: true });
try {
  await mkdir(output, { recursive: true });
  const live = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await live.newPage();
  const consoleErrors = [],
    requestFailures = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") consoleErrors.push(e.text());
  });
  page.on("requestfailed", (r) =>
    requestFailures.push({ url: r.url(), error: r.failure()?.errorText }),
  );
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Small tools. Big sparks." }),
  ).toBeVisible();
  try {
    await expect(page.locator(".registry-health")).toContainText(
      "Read at block",
      { timeout: 45000 },
    );
    reports.live.rpc = "pass";
  } catch {
    reports.live.rpc = "unavailable";
    reports.live.error = await page.locator(".registry-health").innerText();
  }
  reports.live.status = await page.locator(".registry-health").innerText();
  reports.live.deadline = await page.locator(".deadline").innerText();
  await page.screenshot({ path: "/tmp/swarm-desktop-top.png" });
  await page.screenshot({
    path: output + "desktop.jpg",
    fullPage: true,
    type: "jpeg",
    quality: 70,
  });
  reports.screenshots.push("desktop.jpg");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.screenshot({
    path: output + "keyboard-focus.jpg",
    type: "jpeg",
    quality: 75,
  });
  reports.screenshots.push("keyboard-focus.jpg");
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  mark("Keyboard skip link and main focus");
  await page.getByRole("link", { name: "Explore the toolkit" }).click();
  await expect(page).toHaveURL(/#toolkit$/);
  await page.getByLabel("Find a toolkit item").fill("SDK");
  await expect(page.locator(".tool-card")).toHaveCount(2);
  await page.getByLabel("Find a toolkit item").fill("nothing-matches");
  await expect(page.getByText("No toolkit items match")).toBeVisible();
  await page.getByRole("button", { name: "Clear toolkit search" }).click();
  await expect(page.locator(".tool-card")).toHaveCount(19);
  mark("Hash navigation, toolkit filtering, empty state and reset");
  await page.getByText("Do I need HACK to enter?", { exact: true }).click();
  await expect(page.locator(".faq-list details[open]")).toContainText(
    "1,000,000,000",
  );
  mark("FAQ disclosure");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "No browser wallet detected",
  );
  mark("Missing wallet recovery");
  for (const width of [1440, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert(
      overflow.scroll <= overflow.viewport,
      JSON.stringify({ width, ...overflow }),
    );
    if (width === 320) {
      await page.screenshot({ path: "/tmp/swarm-mobile-top.png" });
      await page.locator(".entry-panel").screenshot({ path: output + "mobile-form.jpg", type: "jpeg", quality: 75 });
      reports.screenshots.push("mobile-form.jpg");
    }
    if (width !== 1440) {
      const path = `viewport-${width}.jpg`;
      await page.screenshot({
        path: output + path,
        fullPage: true,
        type: "jpeg",
        quality: 65,
      });
      reports.screenshots.push(path);
    }
    mark(`No horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  reports.live.axe = accessibility.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
  reports.live.consoleErrors = consoleErrors;
  reports.live.requestFailures = requestFailures;
  reports.live.contrast = await page.evaluate(() => {
    const selectors = [
      "body",
      ".experiment-banner p",
      ".muted",
      ".button.primary",
      ".deadline",
      ".badge.inverse",
      ".tool-state",
      ".error",
      ".footer-bottom",
    ];
    function rgb(value) {
      return value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    }
    function luminance(color) {
      const c = rgb(color).map((v) => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    }
    return selectors.map((selector) => {
      const el = document.querySelector(selector);
      if (!el) return { selector, unverified: true };
      const fg = getComputedStyle(el).color;
      let node = el,
        bg;
      while (node && (!bg || bg === "rgba(0, 0, 0, 0)")) {
        bg = getComputedStyle(node).backgroundColor;
        node = node.parentElement;
      }
      const a = luminance(fg),
        b = luminance(bg);
      return {
        selector,
        foreground: fg,
        background: bg,
        ratio: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2),
      };
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".button.primary")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  mark("Reduced motion disables button transitions");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  mark("200% root text enlargement reflow (not native browser zoom)");
  await live.close();

  const account = "0x1111111111111111111111111111111111111111";
  const other = "0x2222222222222222222222222222222222222222";
  const organiser = "0x9e134c3dedDb698B81C9E1581925766b62d26400";
  const blockHash = "0x" + "ab".repeat(32),
    txHash = "0x" + "cd".repeat(32),
    zeroHash = "0x" + "00".repeat(32);
  let currentAccount = account,
    chainId = manifest.chainId,
    now = Math.floor(Date.now() / 1000),
    deadline = now + 86400 * 9;
  let records = [],
    sent = [],
    reject = false,
    revertReceipt = false,
    missingCode = false,
    rpcDown = false,
    rpcChain = manifest.chainId;
  const makeEntry = (i, withdrawn = false) => ({
    entrant: i === 1 ? account : other,
    projectName: `Community project ${i}`,
    repositoryUrl: "https://github.com/example/project",
    demoUrl: "https://example.com/demo",
    toolkitMask: 3n,
    withdrawn,
  });
  const block = () => ({
    number: toHex(12000000),
    hash: blockHash,
    parentHash: zeroHash,
    timestamp: toHex(now),
    transactions: [],
    baseFeePerGas: "0x1",
    gasLimit: "0x1c9c380",
    gasUsed: "0x0",
    difficulty: "0x0",
    totalDifficulty: "0x0",
    nonce: "0x0000000000000000",
    sha3Uncles: zeroHash,
    logsBloom: "0x" + "00".repeat(256),
    miner: other,
    stateRoot: zeroHash,
    transactionsRoot: zeroHash,
    receiptsRoot: zeroHash,
    extraData: "0x",
    size: "0x100",
    uncles: [],
  });
  function rpc(method, params = []) {
    if (rpcDown)
      throw {
        code: -32000,
        message: "RPC temporarily unavailable. Retry later.",
      };
    if (method === "eth_chainId") return toHex(rpcChain);
    if (method === "eth_blockNumber") return toHex(12000000);
    if (method === "eth_getBlockByNumber") return block();
    if (method === "eth_getCode") return missingCode ? "0x" : "0x60006000";
    if (method === "eth_getTransactionReceipt")
      return {
        transactionHash: txHash,
        transactionIndex: "0x0",
        blockHash,
        blockNumber: toHex(12000000),
        from: currentAccount,
        to: registry.address,
        cumulativeGasUsed: "0x5208",
        gasUsed: "0x5208",
        effectiveGasPrice: "0x1",
        contractAddress: null,
        logs: [],
        logsBloom: "0x" + "00".repeat(256),
        status: revertReceipt ? "0x0" : "0x1",
        type: "0x2",
      };
    if (method === "eth_call") {
      const { functionName, args = [] } = decodeFunctionData({
        abi,
        data: params[0].data,
      });
      const ownId =
        records.findIndex(
          (e) =>
            e.entrant.toLowerCase() ===
            (args[0] || "").toString().toLowerCase(),
        ) + 1;
      const values = {
        deadline: BigInt(deadline),
        entryCount: BigInt(records.length),
        ORGANISER: organiser,
        entryIdOf: BigInt(ownId),
        getEntry: records[Number(args[0]) - 1],
        register: BigInt(records.length + 1),
      };
      if (["update", "withdraw"].includes(functionName)) return "0x";
      if (!(functionName in values))
        throw Error("Unhandled contract call: " + functionName);
      return encodeFunctionResult({
        abi,
        functionName,
        result: values[functionName],
      });
    }
    throw Error("Unhandled RPC method " + method);
  }
  async function newMock({ corruptedAbi = false } = {}) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const p = await context.newPage();
    await p.route("https://**", async (route) => {
      if (
        !manifest.network.rpcUrls.includes(
          route.request().url().replace(/\/$/, ""),
        )
      ) {
        await route.abort();
        return;
      }
      const body = route.request().postDataJSON();
      const handle = (item) => {
        try {
          return {
            id: item.id,
            jsonrpc: "2.0",
            result: rpc(item.method, item.params),
          };
        } catch (e) {
          return {
            id: item.id,
            jsonrpc: "2.0",
            error: { code: e.code || -32000, message: e.message },
          };
        }
      };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          Array.isArray(body) ? body.map(handle) : handle(body),
        ),
      });
    });
    if (corruptedAbi)
      await p.route("**/abi/HackathonRegistry.json", (route) =>
        route.fulfill({ contentType: "application/json", body: "[]" }),
      );
    await p.exposeFunction("walletRequest", ({ method, params }) => {
      if (
        reject &&
        [
          "eth_requestAccounts",
          "eth_sendTransaction",
          "wallet_switchEthereumChain",
        ].includes(method)
      )
        return { error: { code: 4001, message: "User rejected the request" } };
      if (["eth_requestAccounts", "eth_accounts"].includes(method))
        return { result: [currentAccount] };
      if (method === "eth_chainId") return { result: toHex(chainId) };
      if (method === "wallet_switchEthereumChain") {
        chainId = Number(params[0].chainId);
        return { result: null };
      }
      if (method === "eth_sendTransaction") {
        const transaction = params[0];
        sent.push(transaction);
        const { functionName, args } = decodeFunctionData({
          abi,
          data: transaction.data,
        });
        if (!revertReceipt) {
          if (functionName === "register")
            records.push({
              entrant: currentAccount,
              projectName: args[0],
              repositoryUrl: args[1],
              demoUrl: args[2],
              toolkitMask: args[3],
              withdrawn: false,
            });
          if (functionName === "update")
            Object.assign(
              records.find((e) => e.entrant === currentAccount),
              {
                projectName: args[0],
                repositoryUrl: args[1],
                demoUrl: args[2],
                toolkitMask: args[3],
              },
            );
          if (functionName === "withdraw")
            records.find((e) => e.entrant === currentAccount).withdrawn = true;
        }
        return { result: txHash };
      }
      return {
        error: { code: -32601, message: "Unhandled wallet method: " + method },
      };
    });
    await p.addInitScript(() => {
      const listeners = {};
      window.ethereum = {
        request: async (args) => {
          const response = await window.walletRequest(args);
          if (response.error) throw response.error;
          return response.result;
        },
        on: (name, fn) => {
          (listeners[name] ||= []).push(fn);
        },
        removeListener: (name, fn) => {
          listeners[name] = (listeners[name] || []).filter((f) => f !== fn);
        },
        emit: (name, value) => {
          (listeners[name] || []).forEach((fn) => fn(value));
        },
      };
    });
    await p.goto(url);
    return { context, p };
  }
  const { context, p } = await newMock();
  await expect(p.locator(".registry-health")).toContainText("Read at block");
  reject = true;
  await p.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await expect(p.getByRole("alert")).toContainText("Wallet request declined");
  reject = false;
  mark("Wallet connection rejection is recoverable");
  chainId = 1;
  await p.getByRole("button", { name: "Connect wallet", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "Register project", exact: true }),
  ).toBeDisabled();
  await p.getByRole("button", { name: "Switch to Sepolia" }).click();
  await expect(
    p.getByRole("button", { name: "Register project", exact: true }),
  ).toBeEnabled();
  mark("Wrong-chain guard and wallet switch");
  await p
    .getByRole("button", { name: "Register project", exact: true })
    .click();
  await expect(p.locator("#projectName")).toBeFocused();
  await expect(p.locator("#projectName-error")).toBeVisible();
  await expect(p.locator("#toolkit-error")).toBeVisible();
  await p.getByLabel("Project name", { exact: false }).fill("✨".repeat(22));
  await p
    .getByLabel("Public repository URL", { exact: false })
    .fill("javascript:alert(1)");
  await p
    .getByLabel("Working demo URL", { exact: false })
    .fill("https://example.com/demo");
  await p.getByLabel("MCP server", { exact: true }).check();
  await p
    .getByRole("button", { name: "Register project", exact: true })
    .click();
  await expect(p.locator("#projectName-error")).toBeVisible();
  await expect(p.locator("#repositoryUrl-error")).toBeVisible();
  assert.equal(sent.length, 0);
  mark("Required fields, UTF-8 byte limits, unsafe URL and toolkit validation");
  await p
    .getByLabel("Project name", { exact: false })
    .fill("A useful swarm tool");
  await p
    .getByLabel("Public repository URL", { exact: false })
    .fill("https://github.com/example/project");
  reject = true;
  await p
    .getByRole("button", { name: "Register project", exact: true })
    .click();
  await expect(p.locator(".entry-panel [role=alert]")).toContainText(
    "Wallet request declined",
  );
  reject = false;
  mark("Transaction rejection retains form and permits retry");
  await p
    .getByRole("button", { name: "Register project", exact: true })
    .click();
  await expect(p.locator(".transaction-status")).toContainText(
    "Registration confirmed",
  );
  await expect(
    p.getByRole("button", { name: "Save entry changes" }),
  ).toBeEnabled();
  await expect(p.locator(".entry-card")).toContainText("A useful swarm tool");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to.toLowerCase(), registry.address.toLowerCase());
  assert.equal(BigInt(sent[0].value || "0x0"), 0n);
  assert.equal(
    decodeFunctionData({ abi, data: sent[0].data }).functionName,
    "register",
  );
  mark(
    "Registration: deployed target, correct ABI, zero ETH, receipt and list refresh",
  );
  await p
    .getByLabel("Project name", { exact: false })
    .fill("A better swarm tool");
  await p.getByRole("button", { name: "Save entry changes" }).click();
  await expect(p.locator(".transaction-status")).toContainText(
    "Update confirmed",
  );
  await expect(p.locator(".entry-card")).toContainText("A better swarm tool");
  mark("Own-entry edit updates metadata and refreshes list");
  revertReceipt = true;
  await p.getByLabel("Project name", { exact: false }).fill("Failed edit");
  await p.getByRole("button", { name: "Save entry changes" }).click();
  await expect(p.locator(".entry-panel [role=alert]")).toContainText(
    "Transaction reverted",
  );
  assert.equal(records[0].projectName, "A better swarm tool");
  revertReceipt = false;
  mark("Reverted receipt never reports a successful change");
  await p.getByRole("button", { name: "Withdraw entry", exact: true }).focus();
  await p.keyboard.press("Enter");
  await expect(p.getByRole("dialog")).toBeVisible();
  await expect(p.getByRole("button", { name: "Keep entry" })).toBeFocused();
  await p.screenshot({ path: output + "withdraw-dialog.jpg", type: "jpeg", quality: 75 });
  reports.screenshots.push("withdraw-dialog.jpg");
  await p.keyboard.press("Escape");
  await expect(p.getByRole("dialog")).not.toBeVisible();
  await expect(
    p.getByRole("button", { name: "Withdraw entry", exact: true }),
  ).toBeFocused();
  mark("Withdrawal dialog: initial focus, Escape, focus return");
  deadline = now;
  await p.getByRole("button", { name: "Refresh registry" }).click();
  await expect(
    p.getByRole("button", { name: "Save entry changes" }),
  ).toBeDisabled();
  await expect(
    p.getByRole("button", { name: "Withdraw entry", exact: true }),
  ).toBeEnabled();
  mark("Exact deadline closes editing while withdrawal remains available");
  await p.getByRole("button", { name: "Withdraw entry", exact: true }).click();
  await p
    .getByRole("button", { name: "Permanently withdraw", exact: true })
    .click();
  await expect(p.locator(".entry-panel")).toContainText(
    "Entry permanently withdrawn",
  );
  await expect(p.locator(".entry-card")).toContainText("Withdrawn");
  mark("Permanent withdrawal is confirmed and cannot be registered again");
  currentAccount = other;
  await p.evaluate(
    (address) => window.ethereum.emit("accountsChanged", [address]),
    other,
  );
  await expect(p.locator(".account-line")).toContainText(other);
  await expect(
    p.getByRole("button", { name: "Withdraw entry", exact: true }),
  ).toHaveCount(0);
  mark("Account changes clear previous ownership and form");
  chainId = 1;
  await p.evaluate(() => window.ethereum.emit("chainChanged", "0x1"));
  await expect(
    p.getByRole("button", { name: "Switch to Sepolia" }),
  ).toBeVisible();
  mark("Chain change events immediately disable actions");
  await p.getByRole("button", { name: "Disconnect wallet" }).click();
  await expect(
    p.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  mark("Local wallet disconnect");
  await context.close();

  records = Array.from({ length: 14 }, (_, i) => makeEntry(i + 1, i === 2));
  records[1].repositoryUrl = "javascript:alert(1)";
  records[1].projectName = "<script>alert(1)</script>";
  deadline = now + 86400;
  chainId = manifest.chainId;
  currentAccount = organiser;
  const many = await newMock();
  await expect(many.p.locator(".entry-card")).toHaveCount(12);
  await expect(many.p.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(
    many.p.getByText("<script>alert(1)</script>", { exact: true }),
  ).toBeVisible();
  await many.p
    .getByLabel("Entry status", { exact: true })
    .selectOption("withdrawn");
  await expect(many.p.locator(".entry-card")).toHaveCount(1);
  await many.p.getByLabel("Search this page").fill("no-match");
  await expect(
    many.p.getByText("No matching projects on this page."),
  ).toBeVisible();
  await many.p
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await many.p.getByRole("button", { name: "Next page" }).click();
  await expect(many.p.locator(".entry-card")).toHaveCount(2);
  await expect(many.p.locator(".pagination")).toContainText("Page 2 of 2");
  mark(
    "Historical entries, status/search filters, pagination and hostile metadata",
  );
  await many.p
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(many.p.locator(".entry-panel .error")).toContainText(
    "Organiser wallets cannot enter",
  );
  await expect(
    many.p.getByRole("button", { name: "Register project", exact: true }),
  ).toBeDisabled();
  mark("Supplied organiser wallet cannot register");
  await many.context.close();

  for (const failure of ["code", "chain", "rpc", "abi"]) {
    missingCode = failure === "code";
    rpcChain = failure === "chain" ? 1 : manifest.chainId;
    rpcDown = failure === "rpc";
    const failing = await newMock({ corruptedAbi: failure === "abi" });
    await expect(failing.p.locator("#projects [role=alert]")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      failing.p.getByRole("button", { name: "Register project", exact: true }),
    ).toBeDisabled();
    if (failure === "rpc") {
      rpcDown = false;
      await failing.p.getByRole("button", { name: "Refresh registry" }).click();
      await expect(failing.p.locator(".registry-health")).toContainText(
        "Read at block",
      );
    }
    mark(
      `Fail-closed ${failure} validation${failure === "rpc" ? " and retry recovery" : ""}`,
    );
    await failing.context.close();
  }
  assert.equal(reports.live.axe.length, 0, JSON.stringify(reports.live.axe));
  mark("Axe WCAG A/AA scan: zero detected violations");
  assert.equal(
    reports.live.consoleErrors.length,
    0,
    JSON.stringify(reports.live.consoleErrors),
  );
  assert.equal(
    reports.live.requestFailures.length,
    0,
    JSON.stringify(reports.live.requestFailures),
  );
  mark("Live production browser: no console errors or failed requests");
  reports.result = "pass";
} catch (e) {
  reports.result = "fail";
  reports.failure = e.stack || String(e);
  throw e;
} finally {
  await writeFile(
    output + "interaction-results.json",
    JSON.stringify(reports, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
