"use client";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";

async function resizeToJpeg(file: File, max = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image"))),
      "image/jpeg",
      0.82
    )
  );
}

export function AvatarUploader({
  memberId,
  name,
  hasAvatar: initial,
  endpoint,
}: {
  memberId: string;
  name: string;
  hasAvatar: boolean;
  endpoint: string;
}) {
  const [hasAvatar, setHasAvatar] = useState(initial);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeToJpeg(file);
      const fd = new FormData();
      fd.append("avatar", blob, "avatar.jpg");
      const res = await fetch(endpoint, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
      setHasAvatar(true);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove");
      setHasAvatar(false);
      setVersion((v) => v + 1);
    } catch {
      setError("Could not remove the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }} data-testid="avatar-uploader">
      <Avatar memberId={memberId} name={name} hasAvatar={hasAvatar} size={68} version={version} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Working…" : hasAvatar ? "Change photo" : "Add photo"}
        </button>
        {hasAvatar && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={remove}>
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          data-testid="avatar-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={onFile}
        />
        {error && <span className="error small">{error}</span>}
      </div>
    </div>
  );
}
