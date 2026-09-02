"use client";
import { CONSENT_CLAUSES, CONSENT_NOTE, CONSENT_VERSION } from "@/lib/consent";

export function Consent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="card tight" style={{ marginTop: 16 }}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Consent &amp; responsibility (v{CONSENT_VERSION})
      </p>
      <ul className="small" style={{ paddingLeft: 18, margin: "6px 0" }}>
        {CONSENT_CLAUSES.map((c, i) => (
          <li key={i} style={{ margin: "6px 0" }}>
            {c}
          </li>
        ))}
      </ul>
      <p className="small muted">{CONSENT_NOTE}</p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--ink)" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 20, height: 20, marginTop: 2 }}
        />
        <span>I have read and agree to the above.</span>
      </label>
    </div>
  );
}
