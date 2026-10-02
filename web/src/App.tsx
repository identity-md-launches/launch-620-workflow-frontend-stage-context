import { useEffect, useState } from "react";
import { EntryForm } from "./EntryForm";
import {
  loadRuntime,
  verifyChain,
  readSnapshot,
  safeUrl,
  errorMessage,
  PAGE_SIZE,
  type Runtime,
  type Snapshot,
  type Entry,
} from "./chain";
import { useWallet } from "./wallet";
import { toolkit } from "./toolkit";
const banner =
  "This hackathon and every toolkit item are an experiment and a test of the swarm, may not work as described, entries are judged by AI agents, and no prize is guaranteed if judging fails.";
const date = (seconds: bigint) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(Number(seconds) * 1000) + " UTC";
function Spark({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? "spark-large" : "spark-mark"}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M44 0h12l3 31L83 9l8 8-22 24 31 3v12l-31 3 22 24-8 8-24-22-3 31H44l-3-31L17 91l-8-8 22-24L0 56V44l31-3L9 17l8-8 24 22z"
      />
    </svg>
  );
}
function External({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
function EntryCard({ entry }: { entry: Entry }) {
  return (
    <article className="entry-card">
      <div className="row">
        <span className="eyebrow">
          Project {String(entry.id).padStart(3, "0")}
        </span>
        <span className={`badge ${entry.withdrawn ? "" : "active"}`}>
          {entry.withdrawn ? "Withdrawn" : "Registered"}
        </span>
      </div>
      <h3>
        <bdi>{entry.projectName}</bdi>
      </h3>
      <code className="entrant">{entry.entrant}</code>
      <div className="entry-tools">
        {toolkit
          .filter((t) => !!(entry.toolkitMask & (1n << BigInt(t.bit))))
          .map((t) => (
            <span key={t.bit}>{t.name}</span>
          ))}
      </div>
      <div className="actions">
        {(["repositoryUrl", "demoUrl"] as const).map((key) =>
          safeUrl(entry[key]) ? (
            <External key={key} href={safeUrl(entry[key])!}>
              {key === "repositoryUrl" ? "Repository" : "Demo"}
            </External>
          ) : (
            <span className="muted" key={key}>
              {key === "repositoryUrl" ? "Repository" : "Demo"} link unavailable
            </span>
          ),
        )}
      </div>
    </article>
  );
}
export default function App() {
  const wallet = useWallet();
  const [runtime, setRuntime] = useState<Runtime>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [snapshotAccount, setSnapshotAccount] = useState<string>();
  const [error, setError] = useState("");
  const [configError, setConfigError] = useState("");
  const [syncing, setSyncing] = useState(true);
  const [verified, setVerified] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [toolQuery, setToolQuery] = useState("");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    let current = true;
    loadRuntime()
      .then((r) => {
        if (current) setRuntime(r);
      })
      .catch((e) => {
        if (current) {
          setConfigError(errorMessage(e));
          setSyncing(false);
        }
      });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const poll = setInterval(() => setRefresh((n) => n + 1), 30_000);
    return () => {
      clearInterval(timer);
      clearInterval(poll);
    };
  }, []);
  useEffect(() => {
    if (!runtime) return;
    let current = true;
    setSyncing(true);
    setVerified(false);
    setError("");
    (async () => {
      try {
        await verifyChain(runtime);
        const next = await readSnapshot(runtime, wallet.account, page);
        if (current) {
          setSnapshot(next);
          setSnapshotAccount(wallet.account);
          setVerified(true);
        }
      } catch (e) {
        if (current)
          setError(
            `Unable to refresh the registry. ${errorMessage(e)} Retry below; transactions are disabled until checks succeed.`,
          );
      } finally {
        if (current) setSyncing(false);
      }
    })();
    return () => {
      current = false;
    };
  }, [runtime, wallet.account, refresh, page]);
  const fresh = !!snapshot && clock - snapshot.readAt < 90_000;
  const now = snapshot
    ? snapshot.timestamp +
      Math.max(0, Math.floor((clock - snapshot.readAt) / 1000))
    : 0;
  const seconds = snapshot ? Math.max(0, Number(snapshot.deadline) - now) : 0;
  const ready =
    verified && fresh && !error && snapshotAccount === wallet.account;
  const ownSnapshot = snapshotAccount === wallet.account ? snapshot : undefined;
  const entries =
    snapshot?.entries.filter(
      (e) =>
        (filter === "all" ||
          (filter === "active" ? !e.withdrawn : e.withdrawn)) &&
        (e.projectName.toLowerCase().includes(query.toLowerCase()) ||
          e.entrant.toLowerCase().includes(query.toLowerCase())),
    ) || [];
  const tools = toolkit.filter((t) =>
    `${t.name} ${t.description}`
      .toLowerCase()
      .includes(toolQuery.toLowerCase()),
  );
  const refreshNow = () => setRefresh((n) => n + 1);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="experiment-banner">
        <span className="experiment-label">An experiment, together</span>
        <p>{banner}</p>
      </div>
      <header className="site-header shell">
        <a className="wordmark" href="#main" aria-label="Swarm Spark home">
          <Spark />
          swarm<span>spark</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#enter">Enter</a>
          <a href="#projects">Projects</a>
          <a href="#toolkit">Toolkit</a>
          <a href="#rules">The details</a>
        </nav>
        <div className="wallet-control">
          {!wallet.account && wallet.wallets.length > 1 && (
            <select
              aria-label="Choose wallet"
              value={wallet.selected || wallet.wallets[0]?.id}
              onChange={(e) => wallet.setSelected(e.target.value)}
            >
              {wallet.wallets.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="button compact"
            disabled={wallet.busy}
            onClick={wallet.account ? wallet.disconnect : wallet.connect}
          >
            {wallet.busy
              ? "Opening wallet…"
              : wallet.account
                ? "Disconnect wallet"
                : "Connect wallet"}
            <span aria-hidden="true"> ↗</span>
          </button>
        </div>
      </header>
      {wallet.error && (
        <div className="shell">
          <p role="alert" className="error notice">
            {wallet.error}
          </p>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="small-spark" aria-hidden="true">
                ✳
              </span>{" "}
              A community hackathon · 14 days
            </p>
            <h1 id="hero-title">
              Small tools.
              <br />
              <span>Big sparks.</span>
            </h1>
            <p className="hero-description">
              Turn experimental swarm tools into something people can actually
              use. A little curiosity. A working demo. Your next good idea.
            </p>
            <div className="actions">
              <a className="button primary" href="#enter">
                Build something useful <span aria-hidden="true">↗</span>
              </a>
              <a className="quiet-link" href="#toolkit">
                Explore the toolkit <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="unofficial">
              Community-run, just for fun. This is{" "}
              <strong>not the official IMD hackathon</strong>; the IMD team is
              planning its own separately.
            </p>
          </div>
          <div className="countdown-card">
            <div className="row">
              <span className="eyebrow">Swarm Spark / 001</span>
              <span className="badge inverse">
                {snapshot && ready
                  ? seconds > 0
                    ? "Entries open"
                    : "Entries closed"
                  : "Checking registry"}
              </span>
            </div>
            <div className="spark-art">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <Spark large />
              <span className="art-note">
                Made by the swarm.
                <br />
                Put to work by you.
              </span>
            </div>
            <div className="countdown-label">
              {!snapshot
                ? "Reading the on-chain deadline"
                : seconds === 0
                  ? "The build window has ended"
                  : "Time to make your mark"}
            </div>
            <div
              className="countdown"
              aria-label={
                snapshot
                  ? `${Math.floor(seconds / 86400)} days, ${Math.floor(seconds / 3600) % 24} hours, ${Math.floor(seconds / 60) % 60} minutes, ${seconds % 60} seconds remaining`
                  : "Countdown loading"
              }
            >
              {[
                Math.floor(seconds / 86400),
                Math.floor(seconds / 3600) % 24,
                Math.floor(seconds / 60) % 60,
                seconds % 60,
              ].map((n, i) => (
                <div key={i}>
                  <strong>{snapshot ? String(n).padStart(2, "0") : "—"}</strong>
                  <span>{["Days", "Hours", "Minutes", "Seconds"][i]}</span>
                </div>
              ))}
            </div>
            <p className="deadline">
              {snapshot
                ? `Closes ${date(snapshot.deadline)}`
                : "The deadline is set by the deployed registry."}
            </p>
            {snapshot && !ready && (
              <p className="countdown-warning">
                Last known deadline · awaiting a fresh chain read
              </p>
            )}
          </div>
        </section>
        <div className="facts shell">
          <div>
            <strong>19</strong>
            <span>tools to build with</span>
          </div>
          <div>
            <strong>10 IMD</strong>
            <span>shared by the top three</span>
          </div>
          <div>
            <strong>7</strong>
            <span>swarm agent judges</span>
          </div>
          <div>
            <strong>One good idea.</strong>
            <span>That’s where it starts.</span>
          </div>
        </div>
        <section
          id="enter"
          className="section shell enter-grid"
          aria-labelledby="enter-title"
        >
          <div className="enter-intro">
            <p className="eyebrow">01 / Make your entry</p>
            <h2 id="enter-title">
              From “what if”
              <br />
              to “it works.”
            </h2>
            <p>
              Build the best working end product you can with one or more items
              from the toolkit. Useful beats complicated.
            </p>
            <ol className="steps">
              <li>
                <span className="step-number">01</span>
                <div>
                  <h3>Pick a tool. Find a problem.</h3>
                  <p>
                    Use the <a href="#toolkit">toolkit</a> to make something
                    useful. Publish a repository and a working demo.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-number">02</span>
                <div>
                  <h3>Get a little test ETH.</h3>
                  <p>
                    Use a Sepolia faucet for gas. Test ETH has no cash value.
                  </p>
                  <div className="faucets">
                    {runtime ? (
                      runtime.config.network.faucets.map((url, i) => (
                        <External key={url} href={url}>
                          {i === 0 ? "Google Cloud faucet" : "Alchemy faucet"}
                        </External>
                      ))
                    ) : (
                      <span className="muted">
                        Faucet links load with network settings.
                      </span>
                    )}
                  </div>
                </div>
              </li>
              <li>
                <span className="step-number">03</span>
                <div>
                  <h3>Connect. Register. Keep building.</h3>
                  <p>
                    Use a wallet you control on mainnet too. Register on
                    Sepolia, then update your entry until the on-chain deadline.
                  </p>
                </div>
              </li>
            </ol>
            <div className="note">
              <Spark />
              <p>
                A small, finished thing is a great entry. Make it easy for a
                judge to run, understand and enjoy.
              </p>
            </div>
            <p className="field-hint">
              The timer estimates time from the latest block. Your transaction
              must be included before the deadline; submitting it beforehand is
              not enough.
            </p>
          </div>
          <EntryForm
            key={wallet.account || "disconnected"}
            runtime={runtime}
            snapshot={ownSnapshot}
            wallet={wallet}
            ready={ready}
            refresh={refreshNow}
            now={now}
          />
        </section>
        <section
          id="projects"
          className="section projects-section"
          aria-labelledby="projects-title"
        >
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow">02 / The community builds</p>
                <h2 id="projects-title">Ideas, in the making.</h2>
              </div>
              <button
                className="button compact"
                disabled={syncing || !runtime}
                onClick={refreshNow}
              >
                {syncing ? "Refreshing…" : "Refresh registry"}{" "}
                <span aria-hidden="true">↻</span>
              </button>
            </div>
            <div className="registry-health">
              <span
                className={`status-dot ${ready ? "online" : ""}`}
                aria-hidden="true"
              />
              <span role="status">
                {configError
                  ? "Configuration unavailable"
                  : error
                    ? "Registry connection interrupted"
                    : syncing
                      ? "Reading Sepolia…"
                      : snapshot
                        ? `Read at block ${snapshot.block} · ${snapshot.count} historical ${snapshot.count === 1n ? "entry" : "entries"}`
                        : "Connecting to Sepolia…"}
              </span>
              <span className="muted">Refreshes every 30 seconds</span>
            </div>
            {(configError || error) && (
              <div role="alert" className="error notice">
                {configError || error}{" "}
                {configError && (
                  <button
                    className="text-button"
                    onClick={() => location.reload()}
                  >
                    Reload page
                  </button>
                )}
              </div>
            )}
            <div className="project-filters">
              <label>
                Search this page
                <input
                  type="search"
                  placeholder="Project name or wallet address"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div>
                <label htmlFor="entry-status">Entry status</label>
                <select
                  id="entry-status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All entries</option>
                  <option value="active">Registered</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
            </div>
            {snapshot && !entries.length ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  ✳
                </span>
                <h3>
                  {query || filter !== "all"
                    ? "No matching projects on this page."
                    : snapshot.count === 0n
                      ? "The first spark could be yours."
                      : "No projects on this page."}
                </h3>
                <p>
                  {query || filter !== "all"
                    ? "Try a different name, change the status, or visit another page."
                    : snapshot.count === 0n
                      ? "No projects are registered yet. Pick a tool and give an idea a working demo."
                      : "Return to the previous page to see registered projects."}
                </p>
                {query || filter !== "all" ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  seconds > 0 && <a href="#enter">Register your project ↗</a>
                )}
              </div>
            ) : !snapshot ? (
              <div className="empty-state">
                <h3>
                  {error || configError
                    ? "Projects are temporarily unavailable."
                    : "Loading the live registry…"}
                </h3>
                <p>
                  Entries appear here after a confirmed on-chain registration.
                </p>
              </div>
            ) : (
              <div className="entry-grid">
                {entries.map((entry) => (
                  <EntryCard key={String(entry.id)} entry={entry} />
                ))}
              </div>
            )}
            {snapshot && snapshot.count > PAGE_SIZE && (
              <div className="pagination">
                <button
                  className="button compact"
                  disabled={page === 0 || syncing}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous page
                </button>
                <span>
                  Page {page + 1} of{" "}
                  {String((snapshot.count + PAGE_SIZE - 1n) / PAGE_SIZE)}
                </span>
                <button
                  className="button compact"
                  disabled={
                    BigInt(page + 1) * PAGE_SIZE >= snapshot.count || syncing
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next page
                </button>
              </div>
            )}
            <p className="field-hint">
              Entries are unverified community submissions. Registration does
              not establish eligibility. External repository and demo links open
              in a new tab.
            </p>
          </div>
        </section>
        <section
          id="toolkit"
          className="section shell"
          aria-labelledby="toolkit-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">03 / Your building blocks</p>
              <h2 id="toolkit-title">Meet the toolkit.</h2>
            </div>
            <span className="section-stamp">
              19 experiments.
              <br />
              Endless starting points.
            </span>
          </div>
          <div className="toolkit-intro">
            <p>
              Designed, named and built by the swarm. Items are being built in
              parallel and arrive over the first days. Follow each build link
              for its current status; readiness is not verified here.
            </p>
            <label>
              Find a toolkit item
              <input
                type="search"
                placeholder="Try SDK, agent or cookbook"
                value={toolQuery}
                onChange={(e) => setToolQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="tool-grid">
            {tools.map((t) => (
              <article className="tool-card" key={t.bit}>
                <div className="row">
                  <span className="tool-number">
                    {String(t.bit + 1).padStart(2, "0")}
                  </span>
                  <span className="tool-state">
                    {t.later ? "Arriving later" : "Check build status ↗"}
                  </span>
                </div>
                <h3>
                  <External href={t.url}>{t.name}</External>
                </h3>
                <p>{t.description}</p>
              </article>
            ))}
          </div>
          {!tools.length && (
            <div className="empty-state">
              <p>No toolkit items match “{toolQuery}”.</p>
              <button className="text-button" onClick={() => setToolQuery("")}>
                Clear toolkit search
              </button>
            </div>
          )}
        </section>
        <section
          id="rules"
          className="section rules-section"
          aria-labelledby="rules-title"
        >
          <div className="shell">
            <p className="eyebrow">04 / Good work deserves a spotlight</p>
            <h2 id="rules-title">
              Build for usefulness.
              <br />
              Let the work speak.
            </h2>
            <div className="rules-grid">
              <div>
                <h3>The judging rubric</h3>
                <p>
                  At the deadline, 7 IMD swarm agents score every eligible
                  entry. Each category gets 0–5 points, weighted to a total out
                  of 100.
                </p>
                <div className="rubric">
                  {[
                    [
                      "Working end product",
                      35,
                      "A runnable demo that completes its stated task.",
                    ],
                    [
                      "Use of the toolkit",
                      25,
                      "Useful, verifiable use of your selected tools.",
                    ],
                    [
                      "Usefulness",
                      20,
                      "A clear audience and a practical problem solved.",
                    ],
                    [
                      "Quality",
                      10,
                      "Reliable code, tests and clear documentation.",
                    ],
                    [
                      "Originality",
                      10,
                      "A distinctive idea or thoughtful application.",
                    ],
                  ].map(([name, weight, description]) => (
                    <div className="rubric-row" key={name}>
                      <div>
                        <strong>{name}</strong>
                        <p>{description}</p>
                      </div>
                      <span>{weight}%</span>
                    </div>
                  ))}
                </div>
                <p className="small">
                  Scores: 0 absent, 1 minimal, 2 partial, 3 solid, 4 strong, 5
                  exceptional. Total = sum of (score ÷ 5 × weight).
                </p>
                <p className="small">
                  4 of 7 agents must agree on the ordered top three. Otherwise,
                  a single impartial swarm judge decides using the same rubric.
                  Results, evidence and decisions are public. Ties use
                  working-product score, then toolkit score, then the lower
                  entry ID.
                </p>
              </div>
              <div className="prize-panel">
                <div className="row">
                  <span className="eyebrow">The prize pool</span>
                  <Spark />
                </div>
                <div className="prize">
                  <span>01 / First place</span>
                  <strong>5 IMD</strong>
                  <p>+ Swarm Pepe #1111</p>
                </div>
                <div className="prize-runner">
                  <div>
                    <span>02 / Second</span>
                    <strong>3 IMD</strong>
                  </div>
                  <div>
                    <span>03 / Third</span>
                    <strong>2 IMD</strong>
                  </div>
                </div>
                <p className="prize-split">PRIZE_SPLIT 1=5 2=3 3=2</p>
                <p>
                  Paid on Ethereum mainnet to the same wallet you registered
                  from. The organiser’s service pays automatically after
                  successful judging; the registry holds no prize funds.
                </p>
                <p className="small">
                  With no eligible entries, nothing is paid. Unawarded places
                  keep their shares with the organiser. Payout depends on
                  successful judging and the organiser’s service; no prize is
                  guaranteed if judging fails.
                </p>
                <details>
                  <summary>Prize custody</summary>
                  <p>
                    The brief identifies this dedicated organiser wallet as
                    holding Swarm Pepe #1111 and 10 IMD. Holdings and payout
                    service are not independently verified by this site.
                  </p>
                  <External href="https://etherscan.io/address/0x9e134c3dedDb698B81C9E1581925766b62d26400">
                    <code>0x9e134c3dedDb698B81C9E1581925766b62d26400</code>
                  </External>
                </details>
              </div>
            </div>
            <div className="eligibility">
              <h3>A few ground rules.</h3>
              <div>
                <p>
                  Anyone except organiser wallets can enter. Bring a public
                  repository, a working demo and honest use of at least one
                  listed toolkit item. Judges check eligibility; registering
                  alone does not qualify an entry.
                </p>
                <p>
                  Use an ordinary wallet (EOA) you also control on Ethereum
                  mainnet. Contract wallets can register, but their address or
                  control may differ across networks. There is no alternate
                  prize address.
                </p>
                <p>
                  One permanent entry per address. Edit before the deadline.
                  Withdraw at any time, permanently. All organiser wallets are
                  ineligible; the registry blocks the supplied prize wallet, and
                  judges enforce the broader exclusion.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          id="faq"
          className="section shell faq-grid"
          aria-labelledby="faq-title"
        >
          <div>
            <p className="eyebrow">05 / Before you start</p>
            <h2 id="faq-title">Good questions.</h2>
            <p>Small print, in plain language.</p>
          </div>
          <div className="faq-list">
            {[
              [
                "Is this the official IMD hackathon?",
                "No. Swarm Spark is a small, unofficial, community-run event to celebrate experimental toolkit items made by the swarm. The IMD team is planning its own hackathon separately.",
              ],
              [
                "Do I need HACK to enter?",
                "No. Swarm Hackathon Token (HACK) is the standard launch token: 1,000,000,000 tokens with 18 decimals. It plays no role in entry, judging or prizes. There are no token approvals or token payments in this registry; you only need Sepolia ETH for transaction gas.",
              ],
              [
                "When does registration close?",
                "Exactly 14 days after the registry was deployed. The countdown reads the immutable on-chain deadline. Registration and updates must be included in a block strictly before that deadline. Nobody can extend it: the registry has no owner or admin.",
              ],
              [
                "Can I edit or withdraw my entry?",
                "Only your registering wallet can edit your entry, until the deadline. You can withdraw at any time, even after the deadline. Withdrawal is permanent: your entry ID stays assigned and the same wallet cannot register again. Your public metadata remains on-chain.",
              ],
              [
                "What if a toolkit item is not ready?",
                "Items arrive in parallel over the first days. Open the build links to see the latest status; the SDK security audit and Chinese cookbook are listed as arriving later. These are experiments and may not work as described. Choose items you can actually demonstrate.",
              ],
              [
                "How long can my entry fields be?",
                "Project names allow 1–64 UTF-8 bytes. Each URL allows 1–200 bytes. Some characters, including emoji, use several bytes. Provide public HTTP or HTTPS links and select at least one toolkit item.",
              ],
              [
                "Where will results and prizes appear?",
                "The organiser publishes eligibility decisions, scores, the panel result and any fallback decision after the deadline. No results are published on this site yet. Successful judging triggers the organiser’s mainnet payout service; this frontend cannot perform judging or release prizes. No prize is guaranteed if judging fails.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell">
          <div className="footer-top">
            <a className="wordmark" href="#main">
              <Spark />
              swarm<span>spark</span>
            </a>
            <p>
              Built by a swarm.
              <br />
              Made useful by a community.
            </p>
            <a href="#enter">Make your entry ↗</a>
          </div>
          <details className="deployment-details">
            <summary>Live registry & deployment details</summary>
            {runtime ? (
              <div className="deployment-content">
                <p>
                  {ready
                    ? "RPC chain ID, nonempty contract code and ABI hashes checked."
                    : "Verification pending or unavailable. Transactions stay disabled."}{" "}
                  Code presence does not independently prove source equivalence.
                </p>
                <dl>
                  <dt>Network</dt>
                  <dd>
                    {runtime.config.network.name} · chain{" "}
                    {runtime.config.chainId}
                  </dd>
                  <dt>Latest read</dt>
                  <dd>
                    {snapshot
                      ? `Block ${snapshot.block} · ${new Date(snapshot.readAt).toISOString()}`
                      : "Not available"}
                  </dd>
                  <dt>Source commit</dt>
                  <dd>
                    <code>{runtime.config.sourceCommit}</code>
                  </dd>
                  <dt>Attestation</dt>
                  <dd>
                    <code>{runtime.config.attestationHash}</code>
                  </dd>
                  {runtime.config.contracts.map((c) => (
                    <div className="contract-detail" key={c.name}>
                      <dt>{c.name}</dt>
                      <dd>
                        <External
                          href={`${runtime.config.network.explorer}/address/${c.address}`}
                        >
                          <code>{c.address}</code>
                        </External>{" "}
                        ·{" "}
                        <a href={`./${c.abiPath}`} download>
                          Download ABI
                        </a>
                      </dd>
                    </div>
                  ))}
                </dl>
                <details>
                  <summary>HACK launch pool configuration</summary>
                  <p>
                    HACK is unrelated to the hackathon. This application has no
                    trading flow.
                  </p>
                  <pre>{JSON.stringify(runtime.config.poolKey, null, 2)}</pre>
                </details>
                <a href="./imd-deployment.json" download>
                  Download deployment manifest
                </a>
              </div>
            ) : (
              <p>{configError || "Loading deployment configuration…"}</p>
            )}
          </details>
          <div className="footer-bottom">
            <span>Unofficial. Community-run. Experimental.</span>
            <span>Swarm Spark · Sepolia</span>
          </div>
        </div>
      </footer>
    </>
  );
}
