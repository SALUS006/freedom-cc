import { describe, expect, it } from "vitest";
import { reduceInnings, deriveResult } from "./engine";
import type { DeliveryPayload, MatchEvent, ScoringConfig } from "./types";

const config: ScoringConfig = {
  overs: 2,
  playersPerSide: 4,
  wideNoballPenalty: 1,
  freeHitOnNoball: true,
  lastManStands: false,
};

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const D = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const P = "11111111-1111-1111-1111-111111111111";
const Q = "22222222-2222-2222-2222-222222222222";

function d(runsBat: number, extra?: Omit<DeliveryPayload, "runsBat">): MatchEvent {
  return { type: "delivery", payload: { runsBat, ...(extra ?? {}) } };
}

describe("strike rotation", () => {
  it("swaps on odd runs, not on even", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(1),
    ];
    let s = reduceInnings(events, config);
    expect(s.strikerId).toBe(B);
    events.push(d(2));
    s = reduceInnings(events, config);
    expect(s.strikerId).toBe(B);
    events.push(d(4));
    s = reduceInnings(events, config);
    expect(s.strikerId).toBe(B);
  });

  it("changes ends after a completed over", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0), d(0), d(0), d(0), d(0), d(0),
    ];
    const s = reduceInnings(events, config);
    expect(s.completedOvers).toBe(1);
    expect(s.ballInOver).toBe(0);
    expect(s.needNewBowler).toBe(true);
    expect(s.strikerId).toBe(B); // swapped at end of over
    expect(s.bowlers[0].maidens).toBe(1);
  });
});

describe("extras", () => {
  it("wide adds a run and is re-bowled (no legal ball)", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0, { extra: "wide" }),
    ];
    const s = reduceInnings(events, config);
    expect(s.runs).toBe(1);
    expect(s.legalBalls).toBe(0);
    expect(s.extras.w).toBe(1);
    expect(s.batters[0].balls).toBe(0);
  });

  it("no-ball: free hit on the next legal delivery", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0, { extra: "noball" }),
    ];
    let s = reduceInnings(events, config);
    expect(s.runs).toBe(1);
    expect(s.freeHit).toBe(true);
    // bowled on a free hit does not count as a wicket
    events.push(d(0, { wicket: { type: "bowled", who: "striker" } }));
    s = reduceInnings(events, config);
    expect(s.wickets).toBe(0);
  });

  it("byes are legal balls credited to the team, not the batter", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0, { extra: "bye", extraRuns: 2 }),
    ];
    const s = reduceInnings(events, config);
    expect(s.runs).toBe(2);
    expect(s.extras.b).toBe(2);
    expect(s.legalBalls).toBe(1);
    expect(s.batters[0].runs).toBe(0);
    expect(s.batters[0].balls).toBe(1);
  });
});

describe("wickets", () => {
  it("striker out, new batter comes in on strike", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0, { wicket: { type: "bowled", who: "striker" } }),
    ];
    let s = reduceInnings(events, config);
    expect(s.wickets).toBe(1);
    expect(s.needNewBatter).toBe(true);
    expect(s.strikerId).toBeNull();
    events.push({ type: "new_batter", batterId: C });
    s = reduceInnings(events, config);
    expect(s.strikerId).toBe(C);
    expect(s.nonStrikerId).toBe(B);
    expect(s.bowlers[0].wickets).toBe(1);
  });

  it("all out closes the innings (squad - 1 wickets)", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0, { wicket: { type: "bowled", who: "striker" } }),
      { type: "new_batter", batterId: C },
      d(0, { wicket: { type: "bowled", who: "striker" } }),
      { type: "new_batter", batterId: D },
      d(0, { wicket: { type: "bowled", who: "striker" } }),
    ];
    const s = reduceInnings(events, config);
    expect(s.wickets).toBe(3);
    expect(s.closed).toBe("all_out");
  });
});

describe("bowler rules", () => {
  it("rejects a bowler bowling two overs in a row", () => {
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0), d(0), d(0), d(0), d(0), d(0),
      { type: "bowler", bowlerId: P }, // same bowler — not allowed
    ];
    let s = reduceInnings(events, config);
    expect(s.needNewBowler).toBe(true);
    expect(s.bowlerId).toBeNull();
    events.push({ type: "bowler", bowlerId: Q });
    s = reduceInnings(events, config);
    expect(s.bowlerId).toBe(Q);
  });

  it("rejects a bowler who is at the per-bowler over cap", () => {
    const capped: ScoringConfig = { ...config, overs: 4, maxOversPerBowler: 1 };
    const events: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(0), d(0), d(0), d(0), d(0), d(0),
      { type: "bowler", bowlerId: Q },
      d(0), d(0), d(0), d(0), d(0), d(0),
      { type: "bowler", bowlerId: P }, // P already bowled his 1 over
    ];
    const s = reduceInnings(events, capped);
    expect(s.needNewBowler).toBe(true);
  });
});

describe("result", () => {
  it("chasing side wins by wickets", () => {
    const first: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(4), d(4), d(2), d(0), d(0), d(0),
      { type: "bowler", bowlerId: Q },
      d(0), d(0), d(0), d(0), d(0), d(0),
    ];
    const firstState = reduceInnings(first, config);
    expect(firstState.runs).toBe(10);

    const second: MatchEvent[] = [
      { type: "openers", strikerId: C, nonStrikerId: D },
      { type: "bowler", bowlerId: A },
      d(6), d(6),
    ];
    const secondState = reduceInnings(second, config, firstState.runs + 1);
    expect(secondState.closed).toBe("target");

    const out = deriveResult(
      config,
      { side: "a", state: firstState, name: "Reds" },
      { side: "b", state: secondState, name: "Blues" }
    );
    expect(out.winner).toBe("b");
    expect(out.summary).toContain("Blues won by");
  });
});
