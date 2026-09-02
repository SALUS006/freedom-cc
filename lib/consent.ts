// Bump the version whenever the wording below changes; each acceptance stores the
// version, timestamp and IP against the member row.
export const CONSENT_VERSION = "2026-09-01";

export const CONSENT_CLAUSES: string[] = [
  "I take part in club cricket voluntarily and I am medically fit to play.",
  "I understand cricket carries inherent risks — being struck by ball or bat, collisions, falls, uneven ground and weather — and I accept those risks.",
  "I release the club, its organisers and other members from liability for injury, illness, loss or damage I suffer while taking part or on the premises, except where the law does not allow such a release.",
  "I am personally and legally responsible for any injury or property damage I cause to another person, and for my own medical costs and insurance.",
  "Any dispute or altercation between members is a personal matter between those individuals; the club and its organisers are not a party to it.",
  "The club may store my name, contact details and match statistics to run the club. This data is not sold or shared outside the club.",
];

export const CONSENT_NOTE =
  "This is a starting template, not legal advice. Enforceability of liability waivers varies by jurisdiction and minors usually need a guardian's signature — have it reviewed locally before relying on it.";

interface InviteEmailArgs {
  clubName: string;
  invitedBy: string;
  playerName: string;
  email: string;
  tempPassword: string;
  signInUrl: string;
}

export function inviteEmailBody(a: InviteEmailArgs): string {
  return [
    `Hi ${a.playerName},`,
    ``,
    `${a.invitedBy} has added you to ${a.clubName} on Freedom CC — the club's`,
    `match-day and scoring app.`,
    ``,
    `Sign in to finish setting up your account:`,
    `  ${a.signInUrl}`,
    ``,
    `  Email:              ${a.email}`,
    `  Temporary password: ${a.tempPassword}`,
    ``,
    `On first sign-in you'll set your own password and be asked to accept the`,
    `club's consent & responsibility terms (v${CONSENT_VERSION}):`,
    ``,
    ...CONSENT_CLAUSES.map((c, i) => `  ${i + 1}. ${c}`),
    ``,
    CONSENT_NOTE,
    ``,
    `See you on the pitch.`,
    `— ${a.clubName}`,
  ].join("\n");
}

