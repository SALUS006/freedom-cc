"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { MatchBundle } from "@/lib/match";
import type { InningsState, MatchEvent, WicketType } from "@/lib/scoring/types";
import { shortName } from "@/lib/scoring/format";

type Squad = MatchBundle["squad"];

const WICKETS: { key: WicketType; label: string; needsFielder?: boolean; cross?: boolean }[] = [
  { key: "bowled", label: "Bowled" },
  { key: "lbw", label: "LBW" },
  { key: "caught", label: "Caught", needsFielder: true, cross: true },
  { key: "stumped", label: "Stumped", needsFielder: true },
  { key: "run_out", label: "Run out", needsFielder: true, cross: true },
  { key: "hit_wicket", label: "Hit wicket" },
];

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ScorePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<MatchBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "wicket" | "extra" | "more">(null);
  const [extraKind, setExtraKind] = useState<"bye" | "legbye">("bye");

  const load = useCallback(() => {
    fetch(`/api/matches/${id}`)
      .then((r) => r.json())
      .then((d) => setBundle(d))
      .catch(() => setError("Could not load match"));
  }, [id]);

  useEffect(load, [load]);

  const current = bundle?.innings[bundle.innings.length - 1] ?? null;
  const state = current?.state ?? null;

  const setState = (next: InningsState) => {
    setBundle((b) => {
      if (!b || !current) return b;
      const innings = b.innings.map((iv) =>
        iv.row.id === current.row.id ? { ...iv, state: next } : iv
      );
      return { ...b, innings };
    });
  };

  async function send(event: MatchEvent) {
    if (!bundle || !current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${id}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inningsSeq: current.row.seq, clientUuid: uuid(), event }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rejected");
      setState(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      setSheet(null);
    }
  }

  async function undo() {
    if (!bundle || !current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${id}/events?inningsSeq=${current.row.seq}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not undo");
      setState(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const battingSquad: Squad = useMemo(() => {
    if (!bundle || !current) return [];
    return bundle.squad
      .filter((s) => s.side === current.battingSide)
      .sort((a, b) => a.batting_order - b.batting_order);
  }, [bundle, current]);

  const bowlingSquad: Squad = useMemo(() => {
    if (!bundle || !current) return [];
    return bundle.squad.filter((s) => s.side !== current.battingSide);
  }, [bundle, current]);

  if (error && !bundle) return <p className="error">{error}</p>;
  if (!bundle || !current || !state) return <p className="muted">Loading…</p>;

  const name = (id2: string | null) => (id2 ? shortName(bundle.names[id2] ?? "?") : "—");
  const maxBalls = bundle.match.max_overs_per_bowler * 6;
  const figs = (id2: string | null) => {
    const b = state.batters.find((x) => x.id === id2);
    return b ? `${b.runs} (${b.balls})` : "0 (0)";
  };

  // ---- pickers ----
  if (!state.closed && state.needOpeners) {
    return (
      <PickTwo
        title="Opening batters"
        subtitle={current.battingName}
        people={battingSquad.map((s) => ({ id: s.member_id, name: s.name ?? "?" }))}
        onPick={(strikerId, nonStrikerId) => send({ type: "openers", strikerId, nonStrikerId })}
        busy={busy}
        backHref={`/play/match/${id}`}
      />
    );
  }

  if (!state.closed && state.needNewBowler) {
    const eligible = bowlingSquad.filter((s) => {
      if (s.member_id === state.previousBowlerId) return false;
      const card = state.bowlers.find((b) => b.id === s.member_id);
      return !card || card.balls < maxBalls;
    });
    return (
      <PickOne
        title="Next over — bowler"
        subtitle={`${current.bowlingName} · not ${name(state.previousBowlerId)}`}
        people={eligible.map((s) => ({
          id: s.member_id,
          name: s.name ?? "?",
          hint: (() => {
            const c = state.bowlers.find((b) => b.id === s.member_id);
            return c ? `${Math.floor(c.balls / 6)}.${c.balls % 6}-${c.runs}-${c.wickets}` : "";
          })(),
        }))}
        onPick={(bowlerId) => send({ type: "bowler", bowlerId })}
        busy={busy}
      />
    );
  }

  if (!state.closed && state.needNewBatter) {
    const out = new Set(state.battedIds);
    const yetToBat = battingSquad.filter((s) => !out.has(s.member_id));
    return (
      <PickOne
        title="Next batter in"
        subtitle={current.battingName}
        people={yetToBat.map((s) => ({ id: s.member_id, name: s.name ?? "?" }))}
        onPick={(batterId) => send({ type: "new_batter", batterId })}
        busy={busy}
      />
    );
  }

  // ---- innings closed ----
  if (state.closed) {
    const isFirst = current.row.seq === 1;
    return (
      <div>
        <div className="screen-head">
          <Link className="back" href={`/play/match/${id}`} aria-label="Back">
            ‹
          </Link>
          <h1>Innings complete</h1>
        </div>
        <div className="scorebar">
          <div className="team">{current.battingName}</div>
          <div className="big">
            {state.runs}/{state.wickets}
          </div>
          <div className="sub">
            {state.oversLabel} overs · {state.closed.replace("_", " ")}
          </div>
        </div>
        {isFirst ? (
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch(`/api/matches/${id}/second-innings`, { method: "POST" });
              if (res.ok) load();
              else setError((await res.json()).error ?? "Could not start 2nd innings");
              setBusy(false);
            }}
          >
            Start 2nd innings
          </button>
        ) : (
          <button
            className="btn btn-success btn-block"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch(`/api/matches/${id}/complete`, { method: "POST" });
              if (res.ok) {
                router.push(`/play/match/${id}`);
                router.refresh();
              } else {
                setError((await res.json()).error ?? "Could not finish match");
                setBusy(false);
              }
            }}
          >
            Finish match
          </button>
        )}
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={undo} disabled={busy}>
          Undo last ball
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // ---- live keypad ----
  const thisOver = state.timeline.filter((t) => t.over === state.completedOvers);
  const ballsLeft = bundle.match.overs * 6 - state.legalBalls;
  const bowlerCard = state.bowlers.find((b) => b.id === state.bowlerId);

  const runBtn = (n: number) => (
    <button
      key={n}
      className={n === 4 ? "run4" : n === 6 ? "run6" : ""}
      disabled={busy}
      onClick={() => send({ type: "delivery", payload: { runsBat: n } })}
    >
      {n}
    </button>
  );

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href={`/play/match/${id}`} aria-label="Back">
          ‹
        </Link>
        <h1>Scoring</h1>
        <Link href={`/play/match/${id}/live`} className="pill brand">
          Live view
        </Link>
      </div>

      <div className="scorebar">
        <div className="teams">
          <span className="team">{current.battingName}</span>
          <span className="team" style={{ opacity: 0.7 }}>
            v {current.bowlingName}
          </span>
        </div>
        <div className="big">
          {state.runs}/{state.wickets}
        </div>
        <div className="sub">
          {state.oversLabel} / {bundle.match.overs} overs · CRR{" "}
          {state.legalBalls ? ((state.runs / state.legalBalls) * 6).toFixed(2) : "0.00"}
        </div>
        {state.target != null && (
          <div className="chase">
            Need {Math.max(0, state.target - state.runs)} off {ballsLeft} · RRR{" "}
            {ballsLeft > 0 ? (((state.target - state.runs) / ballsLeft) * 6).toFixed(2) : "—"}
          </div>
        )}
        {state.freeHit && <span className="freehit">Free hit</span>}
      </div>

      <div className="crease">
        <div className="bat on">
          <span>🏏 {name(state.strikerId)}</span>
          <span className="figs">{figs(state.strikerId)}</span>
        </div>
        <div className="bat">
          <span>{name(state.nonStrikerId)}</span>
          <span className="figs">{figs(state.nonStrikerId)}</span>
        </div>
      </div>

      <div className="bowl-line">
        <span>
          <strong style={{ color: "var(--fg)" }}>{name(state.bowlerId)}</strong>
          {bowlerCard &&
            ` ${Math.floor(bowlerCard.balls / 6)}.${bowlerCard.balls % 6}-${bowlerCard.runs}-${bowlerCard.wickets}`}
        </span>
        <span className="ballseq" style={{ marginLeft: "auto" }}>
          {thisOver.length === 0 && <span className="ball">–</span>}
          {thisOver.map((t, i) => (
            <span
              key={i}
              className={`ball ${t.wicket ? "w" : t.extra ? "ex" : t.runs >= 4 ? "bd" : ""}`}
            >
              {t.label}
            </span>
          ))}
        </span>
      </div>

      <div className="keypad">
        {[0, 1, 2, 3].map(runBtn)}
        {runBtn(4)}
        {runBtn(6)}
        <button
          className="extra"
          disabled={busy}
          onClick={() => send({ type: "delivery", payload: { runsBat: 0, extra: "wide" } })}
        >
          Wide
        </button>
        <button
          className="extra"
          disabled={busy}
          onClick={() => send({ type: "delivery", payload: { runsBat: 0, extra: "noball" } })}
        >
          No-ball
        </button>

        <button
          className="extra"
          disabled={busy}
          onClick={() => {
            setExtraKind("bye");
            setSheet("extra");
          }}
        >
          Bye
        </button>
        <button
          className="extra"
          disabled={busy}
          onClick={() => {
            setExtraKind("legbye");
            setSheet("extra");
          }}
        >
          Leg-bye
        </button>
        <button className="wkt span2" disabled={busy} onClick={() => setSheet("wicket")}>
          Wicket
        </button>

        <button className="util span2" disabled={busy} onClick={undo}>
          ↶ Undo
        </button>
        <button className="util span2" disabled={busy} onClick={() => setSheet("more")}>
          More…
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {sheet === "extra" && (
        <ExtraSheet
          kind={extraKind}
          onClose={() => setSheet(null)}
          onPick={(runs) =>
            send({ type: "delivery", payload: { runsBat: 0, extra: extraKind, extraRuns: runs } })
          }
        />
      )}
      {sheet === "wicket" && (
        <WicketSheet
          striker={name(state.strikerId)}
          nonStriker={name(state.nonStrikerId)}
          fielders={bowlingSquad.map((s) => ({ id: s.member_id, name: s.name ?? "?" }))}
          freeHit={state.freeHit}
          onClose={() => setSheet(null)}
          onConfirm={(payload) => send({ type: "delivery", payload })}
        />
      )}
      {sheet === "more" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>More</h2>
          <div className="stack">
            <button className="btn btn-ghost btn-block" onClick={() => send({ type: "swap_strike" })}>
              Swap strike
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                if (state.strikerId) send({ type: "retire", batterId: state.strikerId, out: false });
              }}
            >
              Retire striker (hurt)
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={() => send({ type: "close_innings", reason: "declared" })}
            >
              End innings now
            </button>
            <button className="btn btn-block" onClick={() => setSheet(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- sub-components ---------- */

function PickOne({
  title,
  subtitle,
  people,
  onPick,
  busy,
}: {
  title: string;
  subtitle?: string;
  people: { id: string; name: string; hint?: string }[];
  onPick: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div>
      <div className="screen-head">
        <h1>{title}</h1>
      </div>
      {subtitle && <p className="muted small" style={{ marginTop: -6 }}>{subtitle}</p>}
      <div className="card flush">
        {people.map((p) => (
          <button key={p.id} className="list-tap" disabled={busy} onClick={() => onPick(p.id)}>
            <span className="lead">{p.name}</span>
            {p.hint && <span className="sub">{p.hint}</span>}
          </button>
        ))}
        {people.length === 0 && <p className="muted small" style={{ padding: 12 }}>No one eligible.</p>}
      </div>
    </div>
  );
}

function PickTwo({
  title,
  subtitle,
  people,
  onPick,
  busy,
  backHref,
}: {
  title: string;
  subtitle?: string;
  people: { id: string; name: string }[];
  onPick: (strikerId: string, nonStrikerId: string) => void;
  busy: boolean;
  backHref: string;
}) {
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  return (
    <div>
      <div className="screen-head">
        <Link className="back" href={backHref} aria-label="Back">
          ‹
        </Link>
        <h1>{title}</h1>
      </div>
      {subtitle && <p className="muted small" style={{ marginTop: -6 }}>{subtitle}</p>}

      <div className="section-title">On strike</div>
      <div className="chip-select">
        {people.map((p) => (
          <button
            key={p.id}
            className={striker === p.id ? "on" : ""}
            onClick={() => setStriker(p.id)}
            disabled={nonStriker === p.id}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="section-title">Non-striker</div>
      <div className="chip-select">
        {people.map((p) => (
          <button
            key={p.id}
            className={nonStriker === p.id ? "on" : ""}
            onClick={() => setNonStriker(p.id)}
            disabled={striker === p.id}
          >
            {p.name}
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary"
        style={{ marginTop: 20 }}
        disabled={busy || !striker || !nonStriker}
        onClick={() => striker && nonStriker && onPick(striker, nonStriker)}
      >
        Start batting
      </button>
    </div>
  );
}

function ExtraSheet({
  kind,
  onPick,
  onClose,
}: {
  kind: "bye" | "legbye";
  onPick: (runs: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{kind === "bye" ? "Byes" : "Leg-byes"} — how many run?</h2>
      <div className="chip-select">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} onClick={() => onPick(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="btn btn-block" style={{ marginTop: 12 }} onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}

function WicketSheet({
  striker,
  nonStriker,
  fielders,
  freeHit,
  onConfirm,
  onClose,
}: {
  striker: string;
  nonStriker: string;
  fielders: { id: string; name: string }[];
  freeHit: boolean;
  onConfirm: (payload: {
    runsBat: number;
    wicket: {
      type: WicketType;
      who: "striker" | "non_striker";
      crossed?: boolean;
      fielderId?: string | null;
    };
  }) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<WicketType>("bowled");
  const [who, setWho] = useState<"striker" | "non_striker">("striker");
  const [crossed, setCrossed] = useState(false);
  const [runs, setRuns] = useState(0);
  const [fielderId, setFielderId] = useState<string>("");
  const meta = WICKETS.find((w) => w.key === type)!;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>How out?</h2>
      {freeHit && <p className="notice warn small">Free hit — only run out / obstructing counts.</p>}
      <div className="chip-select">
        {WICKETS.map((w) => (
          <button key={w.key} className={type === w.key ? "on" : ""} onClick={() => setType(w.key)}>
            {w.label}
          </button>
        ))}
      </div>

      {type === "run_out" && (
        <>
          <div className="section-title">Who is out?</div>
          <div className="chip-select">
            <button className={who === "striker" ? "on" : ""} onClick={() => setWho("striker")}>
              {striker}
            </button>
            <button className={who === "non_striker" ? "on" : ""} onClick={() => setWho("non_striker")}>
              {nonStriker}
            </button>
          </div>
          <div className="section-title">Runs completed first</div>
          <div className="chip-select">
            {[0, 1, 2, 3].map((n) => (
              <button key={n} className={runs === n ? "on" : ""} onClick={() => setRuns(n)}>
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      {meta.cross && (
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, textTransform: "none", fontSize: "0.9rem", color: "var(--fg)" }}>
          <input
            type="checkbox"
            checked={crossed}
            onChange={(e) => setCrossed(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          Batters had crossed
        </label>
      )}

      {meta.needsFielder && (
        <>
          <label>Fielder{type === "stumped" ? " / keeper" : ""}</label>
          <select value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
            <option value="">—</option>
            {fielders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </>
      )}

      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: 16 }}
        onClick={() =>
          onConfirm({
            runsBat: type === "run_out" ? runs : 0,
            wicket: {
              type,
              who: type === "run_out" ? who : "striker",
              crossed: meta.cross ? crossed : undefined,
              fielderId: meta.needsFielder ? fielderId || null : null,
            },
          })
        }
      >
        Confirm wicket
      </button>
      <button className="btn btn-block" style={{ marginTop: 8 }} onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
