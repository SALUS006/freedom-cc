export function BrandBar({ tag }: { tag?: string }) {
  return (
    <header className="brandbar">
      <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#c9402f" />
        <path
          d="M16 2a14 14 0 0 1 0 28"
          fill="none"
          stroke="#f4e9c9"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="0.3 4"
        />
      </svg>
      <span className="word">Freedom CC</span>
      <span className="tag">{tag ?? "Club scoring"}</span>
    </header>
  );
}
