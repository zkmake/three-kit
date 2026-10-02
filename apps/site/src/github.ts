/**
 * The repo's star count, read once at build time for the landing page's GitHub button (anonymous:
 * one call a build is well inside the rate limit). Any failure, or too few stars to be worth
 * showing, gives `null` and the button goes without.
 */
import { REPO_URL } from "./libraries.ts";

/** Below this the count reads as a weakness rather than proof. */
const MIN_SHOWN = 10;

const repoStars = async (): Promise<number | null> => {
  try {
    const response = await fetch(REPO_URL.replace("github.com", "api.github.com/repos"), {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return null;
    }

    const { stargazers_count: stars } = (await response.json()) as { stargazers_count?: number };

    return typeof stars === "number" && stars >= MIN_SHOWN ? stars : null;
  } catch {
    return null;
  }
};

/** 1234 → "1.2k". */
const formatStars = (stars: number) =>
  stars >= 1000 ? `${(stars / 1000).toFixed(stars >= 10_000 ? 0 : 1)}k` : String(stars);

export { formatStars, repoStars };
