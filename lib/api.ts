import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./session";

export function ok(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data ?? { ok: true }, init);
}

export function fail(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof HttpError) return fail(err.status, err.message);
  if (err instanceof ZodError) {
    return fail(400, err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  // Unique-violation etc. from Postgres surface as generic 400s.
  if (/duplicate key|already exists|unique constraint/i.test(message)) return fail(409, message);
  console.error(err);
  return fail(500, "Server error");
}
