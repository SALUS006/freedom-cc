import { describe, expect, it } from "vitest";
import { reduceInnings } from "./engine";
import {
  battingPoints,
  bowlingPoints,
  computeMatchStats,
  pickManOfMatch,
  statLine,
} from "./points";
import type { MatchEvent, ScoringConfig } from "./types";

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

function d(runsBat: number, extra?: object): MatchEvent {
  return { type: "delivery", payload: { runsBat, ...(extra ?? {}) } };
}

describe("battingPoints", () => {
  it("counts the base run value plus boundary bonus", () => {
    // 4 fours = 16 runs + 4 bonus = 20, not out with < 10 balls (no SR bucket)
    expect(battingPoints(16, 8, 4, 0, "not_out")).toBe(16 + 4 + 2); // +2 not-out bonus
  });

  it("stacks milestone bonuses as each threshold is crossed", () => {
    // 100 runs off 60 balls, out: base 100 + milestones (4+8+16)=28; SR 166 -> +6
    expect(battingPoints(100, 60, 6, 4, "caught")).toBe(100 + 6 * 1 + 4 * 2 + 28 + 6);
  });

  it("penalises a duck but not a not-out zero", () => {
    expect(battingPoints(0, 3, 0, 0, "bowled")).toBe(-2);
    expect(battingPoints(0, 3, 0, 0, "not_out")).toBe(2); // survival bonus, no duck
  });

  it("penalises a very slow innings once balls faced is meaningful", () => {
    // 5 runs off 15 balls -> SR 33.3 -> -4; not out -> +2
    expect(battingPoints(5, 15, 0, 0, "not_out")).toBe(5 - 4 + 2);
  });
});

describe("bowlingPoints", () => {
  it("rewards wickets with a 3-for bonus", () => {
    expect(bowlingPoints({ balls: 12, runs: 10, wickets: 3, maidens: 0, dots: 6 })).toBe(
      3 * 20 + 8 + 6 * 0.25 + 2 // econ 5.0 -> +2
    );
  });

  it("penalises an expensive spell", () => {
    // 2 overs (12 balls), 24 runs -> econ 12 -> -6
    expect(bowlingPoints({ balls: 12, runs: 24, wickets: 0, maidens: 0, dots: 0 })).toBe(-6);
  });

  it("does not apply an economy bucket under 2 overs", () => {
    expect(bowlingPoints({ balls: 6, runs: 20, wickets: 0, maidens: 0, dots: 0 })).toBe(0);
  });
});

describe("computeMatchStats — end to end off real innings", () => {
  const squad = [
    { memberId: A, side: "a" as const, isCaptain: true },
    { memberId: B, side: "a" as const, isCaptain: false },
    { memberId: C, side: "a" as const, isCaptain: false },
    { memberId: D, side: "a" as const, isCaptain: false },
    { memberId: P, side: "b" as const, isCaptain: true },
    { memberId: Q, side: "b" as const, isCaptain: false },
  ];

  it("credits batting, bowling, fielding and a result bonus to the right players", () => {
    const firstEvents: MatchEvent[] = [
      { type: "openers", strikerId: A, nonStrikerId: B },
      { type: "bowler", bowlerId: P },
      d(4), // A: 4 runs
      d(0, { wicket: { type: "caught", who: "striker", fielderId: Q } }), // A out, caught by Q
      { type: "new_batter", batterId: C },
      d(6), // C: 6 runs
    ];
    const first = reduceInnings(firstEvents, config);
    expect(first.runs).toBe(10);
    expect(first.batters.find((b) => b.id === A)?.out).toBe("caught");

    const secondEvents: MatchEvent[] = [
      { type: "openers", strikerId: P, nonStrikerId: Q },
      { type: "bowler", bowlerId: A },
      d(6),
      d(6), // 12 >= target 11 -> innings closes
    ];
    const second = reduceInnings(secondEvents, config, first.runs + 1);
    expect(second.closed).toBe("target");

    const stats = computeMatchStats({
      squad,
      innings: [
        { battingSide: "a", state: first },
        { battingSide: "b", state: second },
      ],
      winner: "b",
    });

    const byId = Object.fromEntries(stats.map((s) => [s.memberId, s]));

    expect(byId[A].batted).toBe(true);
    expect(byId[A].runs).toBe(4);
    expect(byId[A].howOut).toBe("caught");
    // B never faced a ball but was at the crease — a valid "not out" record
    expect(byId[B].batted).toBe(true);
    expect(byId[B].howOut).toBe("not_out");
    // Q (fielding for side b while a batted) took the catch that dismissed A
    expect(byId[Q].catches).toBe(1);
    expect(byId[Q].fieldPoints).toBe(8);
    // side "b" won -> P (captain) gets the captain bonus, Q just the win bonus, side a gets none
    expect(byId[P].resultPoints).toBe(6);
    expect(byId[Q].resultPoints).toBe(4);
    expect(byId[A].resultPoints).toBe(0);
    // totals reconcile
    for (const s of stats) {
      expect(s.totalPoints).toBeCloseTo(s.batPoints + s.bowlPoints + s.fieldPoints + s.resultPoints, 5);
    }
  });
});

describe("pickManOfMatch", () => {
  const base = {
    isCaptain: false,
    batted: false,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    howOut: null,
    bowled: false,
    legalBalls: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    batPoints: 0,
    bowlPoints: 0,
    fieldPoints: 0,
    resultPoints: 0,
  };

  it("picks the highest total", () => {
    const stats = [
      { ...base, memberId: A, side: "a" as const, totalPoints: 40 },
      { ...base, memberId: B, side: "a" as const, totalPoints: 65 },
    ];
    expect(pickManOfMatch(stats, {})).toBe(B);
  });

  it("breaks a tie on wickets, then runs, then name", () => {
    const tiedOnPoints = [
      { ...base, memberId: A, side: "a" as const, totalPoints: 50, wickets: 1, runs: 40 },
      { ...base, memberId: B, side: "a" as const, totalPoints: 50, wickets: 3, runs: 10 },
    ];
    expect(pickManOfMatch(tiedOnPoints, {})).toBe(B); // more wickets wins

    const tiedOnWickets = [
      { ...base, memberId: A, side: "a" as const, totalPoints: 50, wickets: 2, runs: 20 },
      { ...base, memberId: B, side: "a" as const, totalPoints: 50, wickets: 2, runs: 45 },
    ];
    expect(pickManOfMatch(tiedOnWickets, {})).toBe(B); // more runs wins

    const tiedOnEverything = [
      { ...base, memberId: B, side: "a" as const, totalPoints: 50, wickets: 2, runs: 20 },
      { ...base, memberId: A, side: "a" as const, totalPoints: 50, wickets: 2, runs: 20 },
    ];
    expect(pickManOfMatch(tiedOnEverything, { [A]: "Aabid", [B]: "Zaheer" })).toBe(A); // alphabetical
  });
});

describe("statLine", () => {
  it("summarises an all-round performance", () => {
    const s = {
      memberId: A,
      side: "a" as const,
      isCaptain: false,
      batted: true,
      runs: 58,
      balls: 34,
      fours: 5,
      sixes: 2,
      howOut: "not_out",
      bowled: true,
      legalBalls: 18,
      runsConceded: 18,
      wickets: 2,
      maidens: 0,
      catches: 1,
      stumpings: 0,
      runOuts: 0,
      batPoints: 0,
      bowlPoints: 0,
      fieldPoints: 0,
      resultPoints: 0,
      totalPoints: 0,
    };
    expect(statLine(s)).toBe("58 (34) & 2/18 & 1ct");
  });
});
