import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata = { title: "Welcome · Freedom CC" };

export default async function Welcome() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "40px 0",
      }}
    >
      <div className="center">
        <img src="/icons/icon.svg" alt="" className="hero-mark" width={76} height={76} />
        <h1
          style={{
            fontSize: "2rem",
            marginTop: 16,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Freedom CC
        </h1>
        <p className="muted" style={{ maxWidth: 320, margin: "6px auto 0" }}>
          Match days, team selection and ball-by-ball scoring — for one club.
        </p>
      </div>

      <div className="card" style={{ marginTop: 30 }}>
        <div className="stack">
          <Link className="btn btn-primary" href="/sign-in">
            Player sign in
          </Link>
          <Link className="btn btn-ghost btn-block" href="/register">
            Register with a club code
          </Link>
        </div>
      </div>

      <p className="small center muted" style={{ marginTop: 18 }}>
        Works offline · installs to your home screen
      </p>
    </div>
  );
}
