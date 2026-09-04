"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarUploader } from "@/app/components/AvatarUploader";

export function AdminPlayerEdit({
  memberId,
  name: name0,
  email: email0,
  hasAvatar,
  isAdmin,
  pending,
}: {
  memberId: string;
  name: string;
  email: string;
  hasAvatar: boolean;
  isAdmin: boolean;
  pending: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(name0);
  const [email, setEmail] = useState(email0);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveDetails() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/players/${memberId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setMsg({ kind: "ok", text: "Saved" });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/players/${memberId}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send reset");
      setMsg({
        kind: "ok",
        text:
          data.emailStatus === "sent"
            ? `Reset link emailed to ${email}.`
            : `Email not configured. Give them this link:\n${data.resetLink}`,
      });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Could not send reset" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card">
        <AvatarUploader
          memberId={memberId}
          name={name}
          hasAvatar={hasAvatar}
          endpoint={`/api/admin/players/${memberId}/avatar`}
        />
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
        <button
          className="btn btn-primary"
          style={{ marginTop: 14 }}
          onClick={saveDetails}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save details"}
        </button>
      </div>

      {!pending && (
        <div className="card tight">
          <div className="row">
            <span>
              <strong>Password</strong>
              <div className="sub small muted">Sends them a one-hour reset link.</div>
            </span>
            <button className="btn btn-sm btn-ghost" onClick={sendReset} disabled={busy}>
              Send reset
            </button>
          </div>
        </div>
      )}
      {isAdmin && <p className="small muted">This member is a club admin.</p>}

      {msg && (
        <p
          className={msg.kind === "ok" ? "notice" : "error"}
          style={{ whiteSpace: "pre-wrap" }}
          data-testid="admin-player-msg"
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
