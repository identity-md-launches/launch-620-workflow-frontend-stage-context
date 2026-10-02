import { useEffect, useRef, useState, type FormEvent } from "react";
import { createWalletClient, custom, type Hash } from "viem";
import {
  byteLength,
  errorMessage,
  readSnapshot,
  validateFields,
  verifyChain,
  type Fields,
  type Runtime,
  type Snapshot,
} from "./chain";
import type { WalletState } from "./wallet";
import { toolkit } from "./toolkit";
export function EntryForm({
  runtime,
  snapshot,
  wallet,
  ready,
  refresh,
  now,
}: {
  runtime?: Runtime;
  snapshot?: Snapshot;
  wallet: WalletState;
  ready: boolean;
  refresh: () => void;
  now: number;
}) {
  const own = snapshot?.own;
  const [fields, setFields] = useState<Fields>({
    projectName: own?.projectName || "",
    repositoryUrl: own?.repositoryUrl || "",
    demoUrl: own?.demoUrl || "",
    toolkitMask: own?.toolkitMask || 0n,
  });
  useEffect(() => {
    if (own)
      setFields({
        projectName: own.projectName,
        repositoryUrl: own.repositoryUrl,
        demoUrl: own.demoUrl,
        toolkitMask: own.toolkitMask,
      });
  }, [own?.id]);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [txError, setTxError] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const closed = snapshot ? now >= Number(snapshot.deadline) : true;
  const correctChain = wallet.chainId === runtime?.config.chainId;
  const organiser =
    !!wallet.account &&
    wallet.account.toLowerCase() === snapshot?.organiser.toLowerCase();
  const available =
    ready &&
    !!wallet.account &&
    correctChain &&
    !busy &&
    !own?.withdrawn &&
    !withdrawConfirmed;
  const canEdit = available && !closed && !organiser;
  async function transact(action: "register" | "update" | "withdraw") {
    if (!runtime || !wallet.provider || !wallet.account || !available) return;
    setBusy(true);
    setTxError("");
    setHash(undefined);
    setStatus("Checking the latest registry state…");
    let submitted: Hash | undefined;
    let receiptObserved = false;
    try {
      const account = wallet.account;
      await verifyChain(runtime);
      const latest = await readSnapshot(runtime, account);
      if (action !== "withdraw" && latest.timestamp >= Number(latest.deadline))
        throw Error("RegistrationClosed");
      if (action === "register" && latest.own) throw Error("AlreadyRegistered");
      if (action !== "register" && (!latest.own || latest.own.withdrawn))
        throw Error("EntryAlreadyWithdrawn");
      if (
        action === "register" &&
        account.toLowerCase() === latest.organiser.toLowerCase()
      )
        throw Error("OrganiserIneligible");
      const args =
        action === "withdraw"
          ? undefined
          : [
              fields.projectName,
              fields.repositoryUrl,
              fields.demoUrl,
              fields.toolkitMask,
            ];
      const { request } = await runtime.client.simulateContract({
        ...runtime.contract,
        account,
        functionName: action,
        args,
      });
      const accounts = await wallet.provider.request({
        method: "eth_accounts",
      });
      const chain = Number(
        await wallet.provider.request({ method: "eth_chainId" }),
      );
      if (
        !active.current ||
        accounts[0]?.toLowerCase() !== account.toLowerCase() ||
        chain !== runtime.config.chainId
      )
        throw Error(
          "Wallet account or network changed. Review your entry and try again.",
        );
      setStatus(
        "Confirm the transaction in your wallet. Only Sepolia gas is required.",
      );
      const client = createWalletClient({
        chain: runtime.chain,
        transport: custom(wallet.provider),
      });
      submitted = await client.writeContract({
        ...request,
        chain: runtime.chain,
        account,
      });
      setHash(submitted);
      setStatus("Transaction submitted. Waiting for a receipt…");
      let replaced = false;
      const receipt = await runtime.client.waitForTransactionReceipt({
        hash: submitted,
        confirmations: 1,
        timeout: 120_000,
        onReplaced: (replacement) => {
          setHash(replacement.transaction.hash);
          replaced = replacement.reason !== "repriced";
        },
      });
      receiptObserved = true;
      if (replaced)
        throw Error(
          "The transaction was replaced or cancelled. Refresh the registry to check whether your intended change was made.",
        );
      if (receipt.status !== "success")
        throw Error(
          "Transaction reverted. The registry was not changed. Check the explorer, refresh and try again.",
        );
      setStatus(
        action === "withdraw"
          ? "Withdrawal confirmed. This entry cannot be restored."
          : action === "update"
            ? "Update confirmed on Sepolia."
            : "Registration confirmed on Sepolia. Your project is in the registry.",
      );
      if (action === "withdraw") setWithdrawConfirmed(true);
      refresh();
    } catch (e) {
      setStatus("");
      setTxError(
        submitted && !receiptObserved
          ? `Receipt not confirmed here: ${errorMessage(e)} Check the transaction in the explorer and refresh before retrying.`
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateFields(fields);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (canEdit) void transact(own ? "update" : "register");
  }
  return (
    <div className="entry-panel">
      <div className="panel-heading">
        <span className="eyebrow">Your workspace</span>
        <span className="badge">Sepolia only</span>
      </div>
      <h3>{own ? `Entry #${own.id}` : "Give your idea a name."}</h3>
      <p className="muted">
        One entry per wallet. No entry fee or HACK required. Your wallet will
        show the Sepolia gas cost.
      </p>
      {!wallet.account && (
        <div className="notice">
          Connect an ordinary wallet you also control on Ethereum mainnet.
          Prizes go to that same address.
        </div>
      )}
      {wallet.account && !correctChain && (
        <div className="notice">
          Your wallet is on another network.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => runtime && wallet.switchChain(runtime)}
            disabled={wallet.busy || busy}
          >
            Switch to Sepolia
          </button>
        </div>
      )}
      {wallet.account && (
        <p className="account-line">
          Connected address <code>{wallet.account}</code>
        </p>
      )}
      {organiser && <p className="error">Organiser wallets cannot enter.</p>}
      {own?.withdrawn || withdrawConfirmed ? (
        <div className="notice">
          <strong>Entry permanently withdrawn.</strong> This wallet cannot
          register again. Its entry remains in the public history.
        </div>
      ) : (
        <>
          {closed && snapshot && (
            <p className="notice">
              Registration and updates are closed. You can still withdraw an
              existing entry.
            </p>
          )}
          <form ref={form} onSubmit={submit} noValidate>
            <fieldset disabled={busy || !!own?.withdrawn} className="fields">
              {(["projectName", "repositoryUrl", "demoUrl"] as const).map(
                (key) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>
                      {key === "projectName"
                        ? "Project name"
                        : key === "repositoryUrl"
                          ? "Public repository URL"
                          : "Working demo URL"}{" "}
                      <span className="field-meta">
                        {byteLength(fields[key])}/
                        {key === "projectName" ? 64 : 200} bytes
                      </span>
                    </label>
                    <input
                      id={key}
                      name={key}
                      type={key === "projectName" ? "text" : "url"}
                      autoComplete="off"
                      required
                      value={fields[key]}
                      aria-invalid={!!errors[key]}
                      aria-describedby={`${key}-hint${errors[key] ? ` ${key}-error` : ""}`}
                      onChange={(e) =>
                        setFields({ ...fields, [key]: e.target.value })
                      }
                      placeholder={
                        key === "projectName"
                          ? "Something worth building"
                          : key === "repositoryUrl"
                            ? "https://github.com/you/project"
                            : "https://your-demo.example"
                      }
                    />
                    <span className="field-hint" id={`${key}-hint`}>
                      {key === "projectName"
                        ? "UTF-8 bytes: some characters use more than one."
                        : "Public HTTP or HTTPS link. Judges need to open it."}
                    </span>
                    {errors[key] && (
                      <span className="error" id={`${key}-error`}>
                        {errors[key]}
                      </span>
                    )}
                  </div>
                ),
              )}
              <fieldset
                className="tool-picker"
                aria-describedby={
                  errors.toolkitMask ? "toolkit-error" : "toolkit-hint"
                }
              >
                <legend>
                  Toolkit used{" "}
                  <span className="field-meta">Choose at least one</span>
                </legend>
                <p className="field-hint" id="toolkit-hint">
                  Select the items your project actually uses.
                </p>
                <div className="tool-options">
                  {toolkit.map((tool) => (
                    <label className="check" key={tool.bit}>
                      <input
                        name="toolkitMask"
                        type="checkbox"
                        checked={
                          !!(fields.toolkitMask & (1n << BigInt(tool.bit)))
                        }
                        aria-invalid={!!errors.toolkitMask}
                        onChange={(e) =>
                          setFields({
                            ...fields,
                            toolkitMask: e.target.checked
                              ? fields.toolkitMask | (1n << BigInt(tool.bit))
                              : fields.toolkitMask & ~(1n << BigInt(tool.bit)),
                          })
                        }
                      />
                      {tool.name}
                    </label>
                  ))}
                </div>
                {errors.toolkitMask && (
                  <p id="toolkit-error" className="error">
                    {errors.toolkitMask}
                  </p>
                )}
              </fieldset>
            </fieldset>
            <p className="field-hint">
              Everything you submit is public on-chain, including after
              withdrawal. Registering confirms that your entry meets the
              eligibility rules below.
            </p>
            <button
              className="button primary wide"
              type="submit"
              disabled={!canEdit}
            >
              {busy
                ? "Transaction in progress…"
                : own
                  ? "Save entry changes"
                  : "Register project"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
            {!wallet.account && (
              <button
                type="button"
                className="button wide"
                disabled={wallet.busy}
                onClick={wallet.connect}
              >
                Connect wallet to register
              </button>
            )}
            {!ready && (
              <p className="field-hint">
                Transactions unlock after live network and registry checks
                succeed.
              </p>
            )}
          </form>
          {own && (
            <div className="withdraw-area">
              <p>
                Withdrawal is permanent. You cannot restore this entry or
                register again from this wallet.
              </p>
              <button
                type="button"
                className="text-button danger"
                disabled={!available}
                onClick={() => dialog.current?.showModal()}
              >
                Withdraw entry
              </button>
            </div>
          )}
        </>
      )}
      <p role="status" className="transaction-status">
        {status}
      </p>
      {txError && (
        <p role="alert" className="error">
          {txError}
        </p>
      )}
      {hash && runtime && (
        <a
          className="transaction-link"
          target="_blank"
          rel="noopener noreferrer"
          href={`${runtime.config.network.explorer}/tx/${hash}`}
        >
          View transaction on explorer ↗<code>{hash}</code>
        </a>
      )}
      <dialog ref={dialog} aria-labelledby="withdraw-title">
        <h3 id="withdraw-title">Permanently withdraw entry?</h3>
        <p>
          Your project will no longer be eligible. This wallet can never
          register another entry. The public record stays on-chain.
        </p>
        <div className="actions">
          <button
            type="button"
            autoFocus
            className="button"
            onClick={() => dialog.current?.close()}
          >
            Keep entry
          </button>
          <button
            type="button"
            className="button destructive"
            onClick={() => {
              dialog.current?.close();
              void transact("withdraw");
            }}
          >
            Permanently withdraw
          </button>
        </div>
      </dialog>
    </div>
  );
}
