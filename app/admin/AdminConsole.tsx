"use client";
import { useState } from "react";
import Link from "next/link";
import type { AdminMember } from "@/lib/data";
import { Avatar } from "@/app/components/Avatar";

function statusOf(m: AdminMember): { label: string; cls: string } {
  if (m.is_admin) return { label: "Admin", cls: "brand" };
  if (!m.consent_at) return { label: "Invited", cls: "ball" };
  return { label: "Active", cls: "turf" };
}

export function AdminConsole({
  clubName,
  inviteCode,
  members: initial,
}: {
  clubName: string;
  inviteCode: string;
  members: AdminMember[];
}) {
  const [members, setMembers] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(inviteCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invite-player", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add player");
      setMembers((list) => [
        {
          id: data.memberId,
          name,
          email,
          is_admin: false,
          has_avatar: false,
          consent_at: null,
          password_reset_required: true,
          created_at: new Date().toISOString(),
        },
        ...list,
      ]);
      setName("");
      setEmail("");
      setMsg({
        kind: "ok",
        text:
          data.emailStatus === "sent"
            ? `Invite emailed to ${email}.`
            : `Player added. Email not sent (${data.emailStatus}). Temp password: ${data.tempPassword} — share it with them.`,
      });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  async function reinvite(m: AdminMember) {
    setMsg(null);
    const res = await fetch("/api/admin/reinvite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: m.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ kind: "err", text: data.error ?? "Could not resend" });
      return;
    }
    setMsg({
      kind: "ok",
      text:
        data.emailStatus === "sent"
          ? `Reminder emailed to ${m.email}.`
          : `New temp password for ${m.name}: ${data.tempPassword}`,
    });
  }

  return (
    <>
      <div className="section-title">Invite code</div>
      <div className="card tight">
        <div className="row">
          <span
            data-testid="invite-code"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.6rem",
              letterSpacing: "0.16em",
              color: "var(--brand)",
            }}
          >
            {inviteCode}
          </span>
          <button className="btn btn-sm btn-ghost" onClick={copyCode}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <p className="small muted" style={{ margin: "8px 0 0" }}>
          Members register at <strong>/register</strong> with this code.
        </p>
      </div>

      <div className="section-title">Add a player by email</div>
      <div className="card">
        <form onSubmit={invite}>
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy}>
            {busy ? "Adding…" : "Add & send invite"}
          </button>
        </form>
        <p className="small muted" style={{ marginBottom: 0, marginTop: 12 }}>
          They get an email with the club waiver, a temporary password and a sign-in link. On first
          sign-in they set their own password and accept the terms.
        </p>
      </div>

      {msg && <p className={msg.kind === "ok" ? "notice" : "error"}>{msg.text}</p>}

      <div className="section-title">Members ({members.length})</div>
      <div className="card flush">
        {members.map((m) => {
          const s = statusOf(m);
          return (
            <Link
              key={m.id}
              href={`/admin/players/${m.id}`}
              className="list-tap"
              style={{ alignItems: "center" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar memberId={m.id} name={m.name} hasAvatar={m.has_avatar} size={36} />
                <span style={{ minWidth: 0 }}>
                  <span className="lead">{m.name}</span>
                  <div className="sub">{m.email}</div>
                </span>
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                  flex: "none",
                }}
              >
                <span className={`pill ${s.cls}`}>{s.label}</span>
                {!m.consent_at && !m.is_admin && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      reinvite(m);
                    }}
                  >
                    Resend
                  </button>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="small muted center" style={{ marginTop: 20 }}>
        {clubName} · Freedom CC
      </p>
    </>
  );
}
