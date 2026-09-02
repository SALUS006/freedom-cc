export const metadata = { title: "Offline · Freedom CC" };

export default function OfflinePage() {
  return (
    <div style={{ paddingTop: 80, textAlign: "center" }}>
      <div style={{ fontSize: 44 }}>📡</div>
      <h1>You&rsquo;re offline</h1>
      <p className="muted">
        Freedom CC needs a connection for this page. Live scorecards you&rsquo;ve already opened
        will still show their last update.
      </p>
      <p>
        <a href="/">Try again</a>
      </p>
    </div>
  );
}
