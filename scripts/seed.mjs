/**
 * Seeds a full demo: "Test CC" with Player-1..Player-16, two 8-a-side teams with
 * captains, a match at the toss, and a live first innings a few balls in — so you
 * can open the scoring console and the live scorecard straight away.
 *
 *   npm run db:reset && npm run seed
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
let cookie = "";

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
  if (res.status >= 400) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

const uuid = () => globalThis.crypto.randomUUID();
const dl = (payload) => ({ type: "delivery", payload });
const PW = "test1234";

// deterministic-but-varied per player
function profileFor(i) {
  const roles = [];
  const bat = 4 + ((i * 3) % 7); // 4..10
  const bowl = 3 + ((i * 5) % 7); // 3..9
  const field = 4 + ((i * 2) % 6); // 4..9
  if (bat >= 6) roles.push("batter");
  if (bowl >= 6) roles.push("bowler");
  if (bat >= 6 && bowl >= 6) roles.push("allrounder");
  const isKeeper = i === 4 || i === 12;
  if (isKeeper) roles.push("keeper");
  if (roles.length === 0) roles.push("batter");
  return {
    phone: "",
    roles: [...new Set(roles)],
    battingStyle: i % 3 === 0 ? "left" : "right",
    bowlingType: bowl >= 6 ? (i % 2 ? "pace" : "off-spin") : null,
    batSelf: bat,
    bowlSelf: bowl,
    fieldSelf: field,
    isKeeper,
    happyToCaptain: i === 1 || i === 9,
  };
}

async function main() {
  console.log(`\nSeeding demo data → ${BASE}\n`);

  // 1. club + admin
  const club = await api("POST", "/api/club", {
    clubName: "Test CC",
    name: "Club Admin",
    email: "admin@test.cc",
    password: PW,
    consent: true,
  }).catch((e) => {
    if (String(e).includes("409") || String(e).includes("already")) {
      console.error("A club already exists. Run `npm run db:reset` first.\n");
      process.exit(2);
    }
    throw e;
  });
  console.log(`club "Test CC" created — invite code ${club.inviteCode}`);

  // 2. register Player-1..16 and set their profiles
  for (let i = 1; i <= 16; i++) {
    cookie = "";
    await api("POST", "/api/auth/register", {
      inviteCode: club.inviteCode,
      name: `Player-${i}`,
      email: `player${i}@test.cc`,
      password: PW,
      consent: true,
    });
    await api("PATCH", "/api/me", profileFor(i));
  }
  console.log("registered Player-1 … Player-16 with roles + self-ratings");

  // 3. admin sets up the match
  cookie = "";
  await api("POST", "/api/auth/sign-in", { email: "admin@test.cc", password: PW });
  const roster = await api("GET", "/api/players");
  const id = (n) => roster.find((m) => m.email === `player${n}@test.cc`).id;
  const teamA = [1, 2, 3, 4, 5, 6, 7, 8].map(id);
  const teamB = [9, 10, 11, 12, 13, 14, 15, 16].map(id);

  const day = await api("POST", "/api/match-days", {
    playedOn: new Date().toISOString().slice(0, 10),
    ground: "Test Ground",
    notes: "Demo match day",
    playerIds: [...teamA, ...teamB],
  });

  const squad = [
    ...teamA.map((memberId, i) => ({
      memberId,
      side: "a",
      battingOrder: i + 1,
      isCaptain: i === 0, // Player-1
      isKeeper: i === 3, // Player-4
    })),
    ...teamB.map((memberId, i) => ({
      memberId,
      side: "b",
      battingOrder: i + 1,
      isCaptain: i === 0, // Player-9
      isKeeper: i === 3, // Player-12
    })),
  ];
  const match = await api("POST", "/api/matches", {
    matchDayId: day.id,
    overs: 8,
    playersPerSide: 8,
    sideAName: "Team Alpha",
    sideBName: "Team Beta",
    rules: { wideNoballPenalty: 1, freeHitOnNoball: true, byesEnabled: true, lastManStands: false },
    squad,
  });
  const M = match.id;
  await api("POST", `/api/matches/${M}/setup`, { tossWinner: "a", elected: "bat" });
  console.log("match created: Team Alpha v Team Beta, 8 overs — Alpha won the toss and bat");

  // 4. score the first over and a bit, leave it live
  const ev = (event) => api("POST", `/api/matches/${M}/events`, { inningsSeq: 1, clientUuid: uuid(), event });
  await ev({ type: "openers", strikerId: id(1), nonStrikerId: id(2) });
  await ev({ type: "bowler", bowlerId: id(9) });
  await ev(dl({ runsBat: 1 }));
  await ev(dl({ runsBat: 4 }));
  await ev(dl({ runsBat: 0 }));
  await ev(dl({ runsBat: 0, extra: "wide" }));
  await ev(dl({ runsBat: 2 }));
  await ev(dl({ runsBat: 6 }));
  await ev(dl({ runsBat: 0, wicket: { type: "bowled", who: "striker" } }));
  await ev({ type: "new_batter", batterId: id(3) });
  await ev(dl({ runsBat: 1 }));
  const state = (await ev({ type: "bowler", bowlerId: id(10) })).state;
  console.log(
    `first innings live: ${state.runs}/${state.wickets} after ${state.oversLabel} overs`
  );

  console.log(`
──────────────────────────────────────────────
  Open the app:   ${BASE}

  Admin login     admin@test.cc      / ${PW}
  Players         player1@test.cc … player16@test.cc  / ${PW}

  Match view      ${BASE}/play/match/${M}
  Scoring console ${BASE}/play/match/${M}/score
  Live scorecard  ${BASE}/play/match/${M}/live
  Squad / balance is under the match day:
                  ${BASE}/play/day/${day.id}
──────────────────────────────────────────────
`);
}

main().catch((e) => {
  console.error("\nseed failed:", e.message || e);
  process.exit(1);
});
