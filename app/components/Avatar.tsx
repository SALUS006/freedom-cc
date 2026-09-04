export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({
  memberId,
  name,
  hasAvatar,
  size = 40,
  version,
}: {
  memberId: string;
  name: string;
  hasAvatar: boolean;
  size?: number;
  version?: number | string;
}) {
  if (hasAvatar) {
    const src = `/api/members/${memberId}/avatar${version ? `?v=${version}` : ""}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="avatar-fallback"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-label={name}
    >
      {initialsOf(name)}
    </span>
  );
}
