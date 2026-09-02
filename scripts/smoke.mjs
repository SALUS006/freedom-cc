/**
 * End-to-end check: registers a club + players, plays a full 2-innings match
 * through the real HTTP API, and asserts the scoring follows standard
 * limited-overs / CricClubs conventions.
 *
 *   npm run db:reset && npm run smoke
 *   BASE_URL=https://your-app.herokuapp.com npm run smoke   (needs an empty DB)
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
let cookie = "";
let pass = 0;
let fail = 0;

function check(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  for (const sc of setCookies) {
    const m = /fcc_session=([^;]+)/.exec(sc || "");
    if (m) cookie = `fcc_session=${m[1]}`;
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

const uuid = () => globalThis.crypto.randomUUID();
const dl = (payload) => ({ type: "delivery", payload });

async function main() {
  console.log(`\nFreedom CC smoke test → ${BASE}\n`);

  // --- club + admin -------------------------------------------------------
  let r = await api("POST", "/api/club", {
    clubName: "Smoke CC",
    name: "Cap Tain",
    email: "cap@smoke.test",
    password: "smoke1234",
    consent: true,
  });
  if (r.status === 409) {
    console.error("A club already exists. Run `npm run db:reset` first.\n");
    process.exit(2);
  }
  check(r.status === 200, "admin creates the club");
  const inviteCode = r.data.inviteCode;
  check(!!inviteCode, `invite code issued (${inviteCode})`);

  // --- players register with the code ----------------------------------
  const players = ["Aarav", "Ben", "Chetan", "Dev", "Esh", "Farhan", "Gopal"];
  for (const name of players) {
    const rr = await api("POST", "/api/auth/register", {
      inviteCode,
      name,
      email: `${name.toLowerCase()}@smoke.test`,
      password: "smoke1234",
      consent: true,
    });
    check(rr.status === 200, `${name} registers with the club code`);
  }

  // back to admin session for setup
  await api("POST", "/api/auth/sign-in", { email: "cap@smoke.test", password: "smoke1234" });
  const roster = (await api("GET", "/api/players")).data;
  check(Array.isArray(roster) && roster.length === 8, "roster has 8 members");
  const id = (email) => roster.find((m) => m.email === email).id;
  const CAP = id("cap@smoke.test");
  const [AAR, BEN, CHE, DEV, ESH, FAR, GOP] = players.map((n) => id(`${n.toLowerCase()}@smoke.test`));

  // --- match day + match ---------------------------------------------------
  const day = await api("POST", "/api/match-days", {
    playedOn: new Date().toISOString().slice(0, 10),
    ground: "Smoke Park",
    playerIds: [CAP, AAR, BEN, CHE, DEV, ESH, FAR, GOP],
  });
  check(day.status === 200, "match day created");

  const sideA = [CAP, AAR, BEN, CHE];
  const sideB = [DEV, ESH, FAR, GOP];
  const squad = [
    ...sideA.map((memberId, i) => ({ memberId, side: "a", battingOrder: i + 1, isCaptain: i === 0, isKeeper: false })),
    ...sideB.map((memberId, i) => ({ memberId, side: "b", battingOrder: i + 1, isCaptain: i === 0, isKeeper: false })),
  ];
  const match = await api("POST", "/api/matches", {
    matchDayId: day.data.id,
    overs: 2,
    playersPerSide: 4,
    sideAName: "Reds",
    sideBName: "Blues",
    rules: { wideNoballPenalty: 1, freeHitOnNoball: true, byesEnabled: true, lastManStands: false },
    squad,
  });
  check(match.status === 200, "match created (2 overs, 4-a-side)");
  const M = match.data.id;

  const setup = await api("POST", `/api/matches/${M}/setup`, { tossWinner: "a", elected: "bat" });
  check(setup.status === 200, "toss set — Reds bat first");

  // --- innings 1 ---------------------------------------------------------
  const ev1 = async (event) => (await api("POST", `/api/matches/${M}/events`, { inningsSeq: 1, clientUuid: uuid(), event })).data.state;

  await ev1({ type: "openers", strikerId: AAR, nonStrikerId: BEN });
  await ev1({ type: "bowler", bowlerId: DEV });

  let s = await ev1(dl({ runsBat: 1 }));
  check(s.strikerId === BEN, "single rotates the strike");

  // undo that single, confirm it reverts, then replay
  s = (await api("DELETE", `/api/matches/${M}/events?inningsSeq=1`)).data.state;
  check(s.runs === 0 && s.strikerId === AAR, "undo reverts the last ball exactly");
  s = await ev1(dl({ runsBat: 1 }));

  s = await ev1(dl({ runsBat: 0, extra: "wide" }));
  check(s.runs === 2 && s.legalBalls === 1 && s.extras.w === 1, "wide = +1, ball re-bowled, not a legal ball");

  s = await ev1(dl({ runsBat: 4 }));
  check(s.runs === 6, "four off the bat");

  s = await ev1(dl({ runsBat: 0, extra: "noball" }));
  check(
    s.runs === 7 && s.freeHit === true && s.legalBalls === 2,
    "no-ball = +1 and arms a free hit (still 2 legal balls bowled)"
  );

  s = await ev1(dl({ runsBat: 6 }));
  check(s.runs === 13 && s.freeHit === false, "six on the free hit, free hit then clears");

  s = await ev1(dl({ runsBat: 0, extra: "bye", extraRuns: 1 }));
  check(s.runs === 14 && s.extras.b === 1 && s.strikerId === AAR, "bye: +1 to Extras, counts as a ball, rotates strike");

  s = await ev1(dl({ runsBat: 0, extra: "legbye", extraRuns: 2 }));
  check(s.runs === 16 && s.extras.lb === 2, "leg-bye: +2 to Extras");

  s = await ev1(dl({ runsBat: 0 }));
  check(
    s.completedOvers === 1 && s.ballInOver === 0 && s.needNewBowler && !s.bowlerId,
    "over ends after 6 legal balls — new bowler required"
  );
  check(s.strikerId === BEN, "strike changes at the end of the over");
  check(s.extras.total === 5, "Extras total = b1 + lb2 + w1 + nb1 = 5");
  const batTotal = s.batters.reduce((n, b) => n + b.runs, 0);
  check(batTotal + s.extras.total === s.runs, "batting runs + Extras reconcile to the team total");

  s = await ev1({ type: "bowler", bowlerId: DEV });
  check(s.needNewBowler === true, "same bowler can't bowl consecutive overs");
  s = await ev1({ type: "bowler", bowlerId: ESH });
  check(s.bowlerId === ESH, "a different bowler is accepted");

  s = await ev1(dl({ runsBat: 0, wicket: { type: "bowled", who: "striker" } }));
  check(s.wickets === 1 && s.needNewBatter, "bowled — wicket falls, new batter needed");
  check(s.fallOfWickets[0].runs === 16 && s.fallOfWickets[0].wicket === 1, "fall of wicket recorded at 16-1");
  await ev1({ type: "new_batter", batterId: CHE });
  s = await ev1(dl({ runsBat: 0, wicket: { type: "bowled", who: "striker" } }));
  await ev1({ type: "new_batter", batterId: CAP });
  s = await ev1(dl({ runsBat: 0, wicket: { type: "bowled", who: "striker" } }));
  check(s.wickets === 3 && s.closed === "all_out", "all out at 3 down (4-a-side)");
  const dev = s.bowlers.find((b) => b.id === ESH);
  check(dev.wickets === 3, "wickets credited to the bowler");

  // --- innings 2 (chase) ----------------------------------------------
  const si = await api("POST", `/api/matches/${M}/second-innings`);
  check(si.status === 200, "second innings starts");
  let bundle = (await api("GET", `/api/matches/${M}`)).data;
  check(bundle.innings[1].row.target === 17, "target = first-innings total + 1 (17)");
  check(bundle.innings[1].battingSide === "b", "Blues bat second");

  const ev2 = async (event) => (await api("POST", `/api/matches/${M}/events`, { inningsSeq: 2, clientUuid: uuid(), event })).data.state;
  await ev2({ type: "openers", strikerId: DEV, nonStrikerId: ESH });
  await ev2({ type: "bowler", bowlerId: AAR });
  await ev2(dl({ runsBat: 6 }));
  await ev2(dl({ runsBat: 6 }));
  await ev2(dl({ runsBat: 4 }));
  s = await ev2(dl({ runsBat: 1 }));
  check(s.runs === 17 && s.closed === "target", "innings closes the moment the target is passed");

  const done = await api("POST", `/api/matches/${M}/complete`);
  check(done.status === 200 && done.data.winner === "b", "match completes — Blues win");
  check(/won by 3 wickets/.test(done.data.summary), `result reads by wickets: "${done.data.summary}"`);
  check(/8 balls? to spare/.test(done.data.summary), "result shows balls to spare");

  bundle = (await api("GET", `/api/matches/${M}`)).data;
  check(bundle.match.status === "complete", "match status is complete");

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nsmoke test crashed:", e);
  process.exit(1);
});
