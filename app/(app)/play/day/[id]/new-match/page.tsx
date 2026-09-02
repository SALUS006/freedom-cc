"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Member } from "@/lib/types";
import type { BalanceReport } from "@/lib/balance";

const OVERS_PRESETS = [5, 6, 8, 9, 10, 12, 15, 20];
type SideKey = "a" | "b" | null;

interface Assign {
  side: SideKey;
  captain: boolean;
  keeper: boolean;
}

export default function NewMatch() {
  const router = useRouter();
  const { id: dayId } = useParams<{ id: string }>();

  const [players, setPlayers] = useState<Member[]>([]);
  const [assign, setAssign] = useState<Record<string, Assign>>({});
  const [overs, setOvers] = useState(10);
  const [aName, setAName] = useState("Side A");
  const [bName, setBName] = useState("Side B");
  const [rules, setRules] = useState({
    wideNoballPenalty: 1,
    freeHitOnNoball: true,
    byesEnabled: true,
    lastManStands: false,
  });
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/match-days/${dayId}`)
      .then((r) => r.json())
      .then((d) => {
        const list: Member[] = d.players ?? [];
        setPlayers(list);
        setAssign(Object.fromEntries(list.map((m) => [m.id, { side: null, captain: false, keeper: false }])));
      })
      .catch(() => setError("Could not load the turnout"));
  }, [dayId]);

  const sideIds = useCallback(
    (s: "a" | "b") => players.filter((p) => assign[p.id]?.side === s).map((p) => p.id),
    [players, assign]
  );

  const aList = sideIds("a");
  const bList = sideIds("b");
  const playersPerSide = Math.max(aList.length, bList.length, 2);

  const setSide = (pid: string, side: SideKey) =>
    setAssign((a) => ({ ...a, [pid]: { ...a[pid], side, captain: side ? a[pid].captain : false } }));

  const toggleFlag = (pid: string, flag: "captain" | "keeper") =>
    setAssign((a) => {
      const cur = a[pid];
      if (flag === "captain" && !cur.captain) {
        // one captain per side
        const next = { ...a };
        for (const p of players) if (next[p.id].side === cur.side) next[p.id] = { ...next[p.id], captain: false };
        next[pid] = { ...cur, captain: true };
        return next;
      }
      return { ...a, [pid]: { ...cur, [flag]: !cur[flag] } };
    });

  // debounced balance report
  useEffect(() => {
    if (aList.length < 2 || bList.length < 2) {
      setReport(null);
      return;
    }
    const t = setTimeout(() => {
      fetch("/api/balance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overs, aName, bName, a: aList, b: bList }),
      })
        .then((r) => r.json())
        .then((d) => setReport(d && !d.error ? d : null))
        .catch(() => setReport(null));
    }, 350);
    return () => clearTimeout(t);
  }, [aList, bList, overs, aName, bName]);

  const bench = useMemo(() => players.filter((p) => !assign[p.id]?.side), [players, assign]);

  async function create() {
    setError(null);
    if (aList.length < 2 || bList.length < 2) {
      setError("Put at least 2 players on each side");
      return;
    }
    if (!aList.some((id) => assign[id].captain) || !bList.some((id) => assign[id].captain)) {
      setError("Pick a captain for each side");
      return;
    }
    setBusy(true);
    const squad = [...aList, ...bList].map((memberId, i) => {
      const side = assign[memberId].side as "a" | "b";
      const withinSide = (side === "a" ? aList : bList).indexOf(memberId);
      return {
        memberId,
        side,
        battingOrder: withinSide + 1,
        isCaptain: assign[memberId].captain,
        isKeeper: assign[memberId].keeper,
      };
    });
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchDayId: dayId,
          overs,
          playersPerSide,
          sideAName: aName,
          sideBName: bName,
          rules,
          squad,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create match");
      router.push(`/play/match/${data.id}/setup`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const SideCol = ({ side, list }: { side: "a" | "b"; list: string[] }) => (
    <div className="card tight">
      <input
        type="text"
        value={side === "a" ? aName : bName}
        onChange={(e) => (side === "a" ? setAName : setBName)(e.target.value)}
        style={{ fontWeight: 700, marginBottom: 6 }}
      />
      {list.length === 0 && <p className="small muted">Tap players below →</p>}
      {list.map((pid) => {
        const p = players.find((x) => x.id === pid)!;
        const a = assign[pid];
        return (
          <div key={pid} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="row">
              <span>{p.name}</span>
              <button className="btn-sm btn-ghost" onClick={() => setSide(pid, null)}>
                ✕
              </button>
            </div>
            <div className="chip-select" style={{ marginTop: 4 }}>
              <button className={a.captain ? "on" : ""} onClick={() => toggleFlag(pid, "captain")}>
                (C)
              </button>
              <button className={a.keeper ? "on" : ""} onClick={() => toggleFlag(pid, "keeper")}>
                (WK)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href={`/play/day/${dayId}`} aria-label="Back">
          ‹
        </Link>
        <h1>New match</h1>
      </div>

      <label>Overs a side</label>
      <div className="chip-select">
        {OVERS_PRESETS.map((o) => (
          <button key={o} className={overs === o ? "on" : ""} onClick={() => setOvers(o)}>
            {o}
          </button>
        ))}
      </div>
      <p className="small muted">
        Max {Math.max(1, Math.ceil(overs / 5))} overs per bowler · {playersPerSide} a side
      </p>

      <div className="grid2" style={{ marginTop: 10 }}>
        <SideCol side="a" list={aList} />
        <SideCol side="b" list={bList} />
      </div>

      <h2>Bench ({bench.length})</h2>
      <div className="card" style={{ padding: "4px 12px" }}>
        {bench.map((p) => (
          <div key={p.id} className="list-tap">
            <span>{p.name}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="btn-sm btn-ghost" onClick={() => setSide(p.id, "a")}>
                → A
              </button>
              <button className="btn-sm btn-ghost" onClick={() => setSide(p.id, "b")}>
                → B
              </button>
            </span>
          </div>
        ))}
        {bench.length === 0 && <p className="small muted">Everyone assigned.</p>}
      </div>

      {report && (
        <>
          <h2>Balance report</h2>
          {(["a", "b"] as const).map((s) => {
            const r = report[s];
            return (
              <div key={s} className="card">
                <div className="row">
                  <strong>{s === "a" ? aName : bName}</strong>
                  <span className="pill turf">{r.overall.toFixed(1)} / 10</span>
                </div>
                <p className="small" style={{ color: "var(--turf)", margin: "6px 0 2px" }}>
                  {r.strengths.join(" · ")}
                </p>
                <p className="small" style={{ color: "var(--ball)", margin: 0 }}>
                  {r.weaknesses.join(" · ")}
                </p>
              </div>
            );
          })}
          <p className="notice">{report.verdict}</p>
        </>
      )}

      <h2>Rules</h2>
      <div className="card tight">
        <label className="row" style={{ margin: "6px 0" }}>
          <span>Wide / no-ball penalty</span>
          <select
            value={rules.wideNoballPenalty}
            onChange={(e) => setRules({ ...rules, wideNoballPenalty: Number(e.target.value) })}
            style={{ width: 80 }}
          >
            <option value={1}>1 run</option>
            <option value={2}>2 runs</option>
          </select>
        </label>
        {(
          [
            ["freeHitOnNoball", "Free hit after no-ball"],
            ["byesEnabled", "Byes & leg-byes"],
            ["lastManStands", "Last man stands"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="row" style={{ margin: "6px 0" }}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={rules[key] as boolean}
              onChange={(e) => setRules({ ...rules, [key]: e.target.checked })}
              style={{ width: 22, height: 22 }}
            />
          </label>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create match & go to toss"}
      </button>
    </div>
  );
}
