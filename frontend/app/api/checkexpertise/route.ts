import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClosedPositions } from "@/lib/polymarket";
import { readContract, writeContract } from "@/lib/contract";

const bodySchema = z.object({
  user_ids: z
    .array(z.string().regex(/^0x[0-9a-fA-F]{40}$/))
    .optional(),
});

// Process at most this many addresses concurrently to avoid hammering Polymarket
const CONCURRENCY = 5;

type MintResult =
  | { proxyWallet: string; eoa: string; txHash: `0x${string}` }
  | { proxyWallet: string; reason: string };

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // 2. Resolve the list of proxyWallet addresses to check
  let proxyWallets: string[];

  if (parsed.data.user_ids && parsed.data.user_ids.length > 0) {
    // Payload mode: caller supplied the list
    proxyWallets = parsed.data.user_ids;
  } else {
    // Contract mode: fetch registered proxies from the smart contract
    try {
      const [, proxies] = await readContract<[string[], string[]]>(
        "getRegistered",
        []
      );
      proxyWallets = proxies;
    } catch (err: unknown) {
      console.error("[checkexpertise] getRegistered error:", err);
      return NextResponse.json(
        { error: "Failed to fetch registered users from contract" },
        { status: 502 }
      );
    }
  }

  if (proxyWallets.length === 0) {
    return NextResponse.json({
      checked: 0,
      experts: [],
      minted: [],
      skipped: [],
    });
  }

  // 3. Fan-out: check closed positions for each proxyWallet
  const experts: string[] = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < proxyWallets.length; i += CONCURRENCY) {
    const batch = proxyWallets.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (proxy) => {
        const positions = await getClosedPositions(proxy);
        return { proxy, isExpert: positions.length > 0 };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.isExpert) {
        experts.push(result.value.proxy);
      } else if (result.status === "rejected") {
        console.warn(
          "[checkexpertise] closed-positions fetch failed:",
          result.reason
        );
      }
    }
  }

  // 4. Mint NFTs for each expert (sequentially to keep nonce ordering simple)
  const minted: MintResult[] = [];
  const skipped: MintResult[] = [];

  for (const proxyWallet of experts) {
    try {
      const { txHash } = await writeContract("mintExpert", [proxyWallet]);

      // Resolve EOA for the response (proxyToEoa mapping)
      const eoa = await readContract<string>("proxyToEoa", [proxyWallet]);
      minted.push({ proxyWallet, eoa, txHash });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("AlreadyMinted")) {
        skipped.push({ proxyWallet, reason: "already minted" });
      } else if (msg.includes("NotRegistered")) {
        skipped.push({ proxyWallet, reason: "not registered in contract" });
      } else {
        console.error("[checkexpertise] mintExpert failed:", proxyWallet, err);
        skipped.push({ proxyWallet, reason: `mint failed: ${msg}` });
      }
    }
  }

  return NextResponse.json({
    checked: proxyWallets.length,
    experts,
    minted,
    skipped,
  });
}
