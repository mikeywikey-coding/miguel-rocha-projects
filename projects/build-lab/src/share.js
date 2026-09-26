import { attributes, baseline, normalizeBuild } from "./data.js";

export function parseBuildLink(text) {
  const raw = text.trim();
  if (raw.startsWith("{")) return normalizeBuild(JSON.parse(raw));
  const url = new URL(raw, location.origin);
  if (url.hash.startsWith("#build="))
    return normalizeBuild(JSON.parse(decodeURIComponent(url.hash.slice(7))));
  const code = url.searchParams.get("b");
  if (!code)
    throw new Error(
      "No build found. Paste a Build Lab or original builder link.",
    );
  const pieces = code.split(".");
  if (pieces.length !== 5)
    throw new Error("The original build code has an unsupported format.");
  const [position, height, weight, wingspan, ratingsString] = pieces;
  const ratings = ratingsString.split("-");
  if (
    ratings.length !== attributes.length ||
    [...ratings, height, weight, wingspan].some((n) => !/^\d+$/.test(n)) ||
    !["PG", "SG", "SF", "PF", "C"].includes(position)
  )
    throw new Error("The build link has missing or invalid values.");
  return normalizeBuild({
    name: "Imported build",
    body: {
      position,
      height: Number(height),
      weight: Number(weight),
      wingspan: Number(wingspan),
    },
    ratings: Object.fromEntries(
      attributes.map((a, i) => [a.id, Number(ratings[i])]),
    ),
    breakers: {},
  });
}
export function buildUrl(build) {
  const url = new URL(location.href);
  url.searchParams.delete("b");
  url.hash = `build=${encodeURIComponent(JSON.stringify(build))}`;
  return url.toString();
}
