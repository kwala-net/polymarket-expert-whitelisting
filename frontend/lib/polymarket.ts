/**
 * Typed helpers for the two Polymarket APIs we use.
 */

// ─── gamma-api: public profile ────────────────────────────────────────────────

export interface PolymarketPublicProfile {
  createdAt: string;
  proxyWallet: string; // the address we care about
  displayUsernamePublic: boolean;
  pseudonym: string;
  name: string;
  verifiedBadge: boolean;
}

/**
 * Fetch a user's Polymarket public profile by their EOA address.
 * Returns null when the profile does not exist (404 / empty body).
 */
export async function getPublicProfile(
  eoa: string
): Promise<PolymarketPublicProfile | null> {
  const res = await fetch(
    `https://gamma-api.polymarket.com/public-profile?address=${eoa}`,
    { headers: { Accept: "application/json" } }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `gamma-api responded ${res.status} for address ${eoa}`
    );
  }

  const data: PolymarketPublicProfile = await res.json();
  if (!data?.proxyWallet) return null;
  return data;
}

// ─── data-api: closed positions ───────────────────────────────────────────────

export interface ClosedPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  avgPrice: number;
  totalBought: number;
  realizedPnl: number;
  curPrice: number;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  endDate: string;
  timestamp: number;
}

function matchFootballQuestion(str: string) {
  const winRegex = /^Will (.+?) win on (\d{4}-\d{2}-\d{2})\?$/;
  const drawRegex = /^Will (.+?) vs\. (.+?) end in a draw\?$/;

  const winMatch = str.match(winRegex);
  if (winMatch) {
    return { type: "win", team: winMatch[1], date: winMatch[2] };
  }

  const drawMatch = str.match(drawRegex);
  if (drawMatch) {
    return { type: "draw", team1: drawMatch[1], team2: drawMatch[2] };
  }

  return null;
}

const PAGE_SIZE = 50;

/**
 * Fetch all closed positions with positive realized PnL for a proxyWallet,
 * paginating until a page contains a non-positive PnL entry or returns empty.
 * Then filters to only football match questions and returns those.
 * A non-empty result means the user qualifies as an "expert".
 */
export async function getClosedPositions(
  proxyWallet: string
): Promise<ClosedPosition[]> {
  const footballPositions: ClosedPosition[] = [];
  let offset = 0;

  while (true) {
    const url = new URL("https://data-api.polymarket.com/closed-positions");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("sortBy", "REALIZEDPNL");
    url.searchParams.set("sortDirection", "DESC");
    url.searchParams.set("user", proxyWallet);
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(
        `data-api responded ${res.status} for proxyWallet ${proxyWallet}`
      );
    }

    const page: ClosedPosition[] = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;

    let hitNonPositive = false;
    for (const position of page) {
      if (position.realizedPnl <= 0) {
        hitNonPositive = true;
        break;
      }
      if (matchFootballQuestion(position.title)) {
        footballPositions.push(position);
      }
    }

    if (hitNonPositive || page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return footballPositions;
}
