import {
  BOWLER_WICKETS,
  type BatterCard,
  type BowlerCard,
  type DeliveryPayload,
  type InningsState,
  type MatchEvent,
  type ScoringConfig,
} from "./types";

interface OverCtx {
  runsCharged: number;
  hadIllegal: boolean;
}

function emptyState(target: number | null): InningsState {
  return {
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    completedOvers: 0,
    ballInOver: 0,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    previousBowlerId: null,
    needOpeners: true,
    needNewBatter: false,
    needNewBowler: false,
    freeHit: false,
    extras: { b: 0, lb: 0, w: 0, nb: 0, total: 0 },
    batters: [],
    bowlers: [],
    fallOfWickets: [],
    timeline: [],
    partnershipRuns: 0,
    partnershipBalls: 0,
    target,
    closed: null,
    battedIds: [],
    oversLabel: "0.0",
  };
}

function batter(state: InningsState, id: string): BatterCard {
  let card = state.batters.find((b) => b.id === id);
  if (!card) {
    card = {
      id,
      order: state.batters.length + 1,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: null,
      outBowlerId: null,
      outFielderId: null,
      onCrease: true,
      retiredNotOut: false,
    };
    state.batters.push(card);
    if (!state.battedIds.includes(id)) state.battedIds.push(id);
  }
  return card;
}

function bowler(state: InningsState, id: string): BowlerCard {
  let card = state.bowlers.find((b) => b.id === id);
  if (!card) {
    card = { id, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0, dots: 0 };
    state.bowlers.push(card);
  }
  return card;
}

function swap(state: InningsState): void {
  const t = state.strikerId;
  state.strikerId = state.nonStrikerId;
  state.nonStrikerId = t;
}

function allOutThreshold(config: ScoringConfig): number {
  return config.lastManStands ? config.playersPerSide : config.playersPerSide - 1;
}

function setOversLabel(state: InningsState): void {
  state.oversLabel = `${state.completedOvers}.${state.ballInOver}`;
}

function checkClosed(state: InningsState, config: ScoringConfig): void {
  if (state.closed) return;
  if (state.target != null && state.runs >= state.target) {
    state.closed = "target";
  } else if (state.wickets >= allOutThreshold(config)) {
    state.closed = "all_out";
  } else if (state.completedOvers >= config.overs && state.ballInOver === 0) {
    state.closed = "overs";
  }
}

function applyDelivery(
  state: InningsState,
  config: ScoringConfig,
  ctx: OverCtx,
  d: DeliveryPayload
): void {
  if (state.closed || state.needOpeners || state.needNewBatter || state.needNewBowler) return;
  if (!state.strikerId || !state.nonStrikerId || !state.bowlerId) return;

  const strikerId = state.strikerId;
  const nonStrikerId = state.nonStrikerId;
  const bowlerId = state.bowlerId;
  const strikerCard = batter(state, strikerId);
  const bowlerCard = bowler(state, bowlerId);

  const penalty = d.extra === "wide" || d.extra === "noball" ? config.wideNoballPenalty : 0;
  const isLegal = d.extra !== "wide" && d.extra !== "noball";
  const extraRuns = d.extraRuns ?? 0;
  const wasFreeHit = state.freeHit;

  // who is dismissed is resolved before any rotation
  let outId: string | null = null;
  let wicket = d.wicket ?? null;
  if (wicket) {
    if (wasFreeHit && wicket.type !== "run_out" && wicket.type !== "obstructing") {
      wicket = null; // not out on a free hit
    } else {
      outId = wicket.who === "striker" ? strikerId : nonStrikerId;
    }
  }

  // --- runs ---
  let batRuns = 0;
  let teamRuns = 0;
  let bowlerRuns = 0;
  let runsRun = 0; // runs physically completed by the batters (drives strike rotation)

  if (d.extra === "wide") {
    teamRuns = penalty + extraRuns;
    bowlerRuns = penalty + extraRuns;
    state.extras.w += penalty + extraRuns;
    runsRun = extraRuns;
    bowlerCard.wides += penalty + extraRuns;
  } else if (d.extra === "noball") {
    batRuns = d.runsBat;
    teamRuns = penalty + d.runsBat + extraRuns;
    bowlerRuns = penalty + d.runsBat + extraRuns;
    state.extras.nb += penalty + extraRuns;
    runsRun = d.runsBat + extraRuns;
    bowlerCard.noballs += penalty + extraRuns;
  } else if (d.extra === "bye") {
    teamRuns = extraRuns;
    state.extras.b += extraRuns;
    runsRun = extraRuns;
  } else if (d.extra === "legbye") {
    teamRuns = extraRuns;
    state.extras.lb += extraRuns;
    runsRun = extraRuns;
  } else {
    batRuns = d.runsBat;
    teamRuns = d.runsBat;
    bowlerRuns = d.runsBat;
    runsRun = d.runsBat;
  }

  state.runs += teamRuns;
  state.extras.total = state.extras.b + state.extras.lb + state.extras.w + state.extras.nb;
  ctx.runsCharged += bowlerRuns;
  if (!isLegal) ctx.hadIllegal = true;

  // batter card
  strikerCard.runs += batRuns;
  if (batRuns === 4) strikerCard.fours += 1;
  if (batRuns === 6) strikerCard.sixes += 1;
  const facesBall = isLegal || d.extra === "noball";
  if (facesBall) strikerCard.balls += 1;

  // bowler card
  if (isLegal) bowlerCard.balls += 1;
  if (isLegal && teamRuns === 0 && !wicket) bowlerCard.dots += 1;

  // partnership
  state.partnershipRuns += teamRuns;
  if (facesBall) state.partnershipBalls += 1;

  // --- strike rotation for completed runs ---
  if (runsRun % 2 === 1) swap(state);

  // --- wicket bookkeeping ---
  if (wicket && outId) {
    state.wickets += 1;
    const outCard = batter(state, outId);
    outCard.out = wicket.type;
    if (BOWLER_WICKETS.includes(wicket.type)) {
      bowlerCard.wickets += 1;
      outCard.outBowlerId = bowlerId;
    }
    if (wicket.type === "caught" || wicket.type === "stumped" || wicket.type === "run_out") {
      outCard.outFielderId = wicket.fielderId ?? null;
    }

    // "crossed" applies to catches and run-outs: one extra positional swap
    if ((wicket.type === "caught" || wicket.type === "run_out") && wicket.crossed) {
      swap(state);
    }

    // vacate whichever crease now holds the dismissed batter
    outCard.onCrease = false;
    if (state.strikerId === outId) state.strikerId = null;
    if (state.nonStrikerId === outId) state.nonStrikerId = null;

    state.fallOfWickets.push({
      wicket: state.wickets,
      runs: state.runs,
      batterId: outId,
      over: `${state.completedOvers}.${state.ballInOver + (isLegal ? 1 : 0)}`,
    });
    state.partnershipRuns = 0;
    state.partnershipBalls = 0;
  }

  // --- ball / over counting ---
  if (isLegal) {
    state.legalBalls += 1;
    state.ballInOver += 1;
    if (state.ballInOver === 6) {
      state.completedOvers += 1;
      state.ballInOver = 0;
      if (!ctx.hadIllegal && ctx.runsCharged === 0) bowlerCard.maidens += 1;
      state.previousBowlerId = bowlerId;
      state.bowlerId = null;
      state.needNewBowler = true;
      ctx.runsCharged = 0;
      ctx.hadIllegal = false;
      swap(state); // change ends at the end of the over
    }
  }

  // free hit management
  if (d.extra === "noball" && config.freeHitOnNoball) {
    state.freeHit = true;
  } else if (wasFreeHit && isLegal) {
    state.freeHit = false;
  }
  // (an illegal ball on a free hit keeps the free hit alive)

  // timeline
  state.timeline.push({
    over: state.completedOvers,
    legalBall: isLegal ? state.ballInOver || 6 : null,
    label: labelFor(d, teamRuns, batRuns, !!wicket),
    runs: teamRuns,
    wicket: !!wicket,
    extra: d.extra ?? null,
  });

  checkClosed(state, config);
  if (!state.closed && (!state.strikerId || !state.nonStrikerId)) {
    state.needNewBatter = true;
  }
  setOversLabel(state);
}

function labelFor(d: DeliveryPayload, teamRuns: number, batRuns: number, wicket: boolean): string {
  if (d.extra === "wide") return teamRuns > 1 ? `${teamRuns}wd` : "wd";
  if (d.extra === "noball") return `nb${batRuns > 0 ? `+${batRuns}` : ""}`;
  if (d.extra === "bye") return `${teamRuns}b`;
  if (d.extra === "legbye") return `${teamRuns}lb`;
  if (wicket) return batRuns > 0 ? `${batRuns}+W` : "W";
  return String(batRuns);
}

/** Fold the append-only event log into a full innings state. */
export function reduceInnings(
  events: MatchEvent[],
  config: ScoringConfig,
  target: number | null = null
): InningsState {
  const state = emptyState(target);
  const ctx: OverCtx = { runsCharged: 0, hadIllegal: false };

  for (const ev of events) {
    switch (ev.type) {
      case "openers": {
        state.strikerId = ev.strikerId;
        state.nonStrikerId = ev.nonStrikerId;
        batter(state, ev.strikerId);
        batter(state, ev.nonStrikerId).onCrease = true;
        state.needOpeners = false;
        break;
      }
      case "bowler": {
        const atOverStart = !state.needOpeners && state.ballInOver === 0;
        const card = state.bowlers.find((b) => b.id === ev.bowlerId);
        const overCap =
          !!config.maxOversPerBowler &&
          !!card &&
          card.balls >= config.maxOversPerBowler * 6;
        const consecutive = atOverStart && ev.bowlerId === state.previousBowlerId;
        if (overCap || consecutive) break; // not a legal choice — keep needNewBowler
        state.bowlerId = ev.bowlerId;
        bowler(state, ev.bowlerId);
        state.needNewBowler = false;
        break;
      }
      case "delivery":
        applyDelivery(state, config, ctx, ev.payload);
        break;
      case "new_batter": {
        const card = batter(state, ev.batterId);
        card.onCrease = true;
        card.out = null;
        card.retiredNotOut = false;
        if (!state.strikerId) state.strikerId = ev.batterId;
        else if (!state.nonStrikerId) state.nonStrikerId = ev.batterId;
        state.needNewBatter = !state.strikerId || !state.nonStrikerId;
        state.partnershipRuns = 0;
        state.partnershipBalls = 0;
        break;
      }
      case "swap_strike":
        swap(state);
        break;
      case "retire": {
        const card = batter(state, ev.batterId);
        card.onCrease = false;
        if (ev.out) {
          card.out = "retired_out";
          state.wickets += 1;
        } else {
          card.retiredNotOut = true;
        }
        if (state.strikerId === ev.batterId) state.strikerId = null;
        if (state.nonStrikerId === ev.batterId) state.nonStrikerId = null;
        checkClosed(state, config);
        if (!state.closed) state.needNewBatter = !state.strikerId || !state.nonStrikerId;
        break;
      }
      case "close_innings":
        state.closed = ev.reason || "declared";
        break;
    }
  }

  setOversLabel(state);
  return state;
}

export interface MatchOutcome {
  winner: "a" | "b" | null;
  tie: boolean;
  summary: string;
}

export function deriveResult(
  config: ScoringConfig,
  first: { side: "a" | "b"; state: InningsState; name: string },
  second: { side: "a" | "b"; state: InningsState; name: string }
): MatchOutcome {
  const target = first.state.runs + 1;
  const chased = second.state.runs;

  if (chased >= target) {
    const wicketsLeft = allOutThreshold(config) - second.state.wickets;
    const ballsLeft = config.overs * 6 - second.state.legalBalls;
    return {
      winner: second.side,
      tie: false,
      summary: `${second.name} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}${
        ballsLeft > 0 ? ` (${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} to spare)` : ""
      }`,
    };
  }
  if (chased === first.state.runs) {
    return { winner: null, tie: true, summary: "Match tied" };
  }
  const margin = first.state.runs - chased;
  return {
    winner: first.side,
    tie: false,
    summary: `${first.name} won by ${margin} run${margin === 1 ? "" : "s"}`,
  };
}
