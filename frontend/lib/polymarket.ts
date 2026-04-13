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

/**
 * Fetch the top 10 closed positions (by realized PnL) for a proxyWallet.
 * Returns an empty array when the user has no closed positions.
 * A non-empty array means the user qualifies as an "expert".
 */
export async function getClosedPositions(
  proxyWallet: string
): Promise<ClosedPosition[]> {
  const url = new URL(
    "https://data-api.polymarket.com/closed-positions"
  );
  url.searchParams.set("limit", "10");
  url.searchParams.set("sortBy", "REALIZEDPNL");
  url.searchParams.set("sortDirection", "DESC");
  url.searchParams.set("user", proxyWallet);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `data-api responded ${res.status} for proxyWallet ${proxyWallet}`
    );
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
