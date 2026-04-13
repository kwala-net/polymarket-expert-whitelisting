import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicProfile } from "@/lib/polymarket";
import { writeContract } from "@/lib/contract";

const bodySchema = z.object({
  eoa: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address"),
});

export async function POST(req: NextRequest) {
  // 1. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { eoa } = parsed.data;

  // 2. Resolve proxyWallet from Polymarket gamma-api
  let proxyWallet: string;
  try {
    const profile = await getPublicProfile(eoa);
    if (!profile) {
      return NextResponse.json(
        { error: "No Polymarket profile found for this address" },
        { status: 404 }
      );
    }
    proxyWallet = profile.proxyWallet;
  } catch (err: unknown) {
    console.error("[register] gamma-api error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Polymarket profile" },
      { status: 502 }
    );
  }

  // 3. Call contract.register(eoa, proxyWallet)
  try {
    const { txHash } = await writeContract("register", [eoa, proxyWallet]);
    return NextResponse.json({ ok: true, txHash, proxyWallet });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // AlreadyRegistered revert — idempotent, not an error from the caller's perspective
    if (msg.includes("AlreadyRegistered")) {
      return NextResponse.json(
        { error: "Address already registered", proxyWallet },
        { status: 409 }
      );
    }

    console.error("[register] contract write error:", err);
    return NextResponse.json(
      { error: "Contract write failed" },
      { status: 500 }
    );
  }
}
