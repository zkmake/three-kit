/**
 * Where the site lives: GitHub Pages serves the repo's site under `/three-kit/`, so every link,
 * asset and fetch goes through `url()` rather than starting at the domain root.
 */

/** The base the site is built under, with a trailing slash: `/three-kit/`. */
export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

/** A path on the site: `url("three-meter/")` is `/three-kit/three-meter/`, `url()` the home page. */
export const url = (path = "") => `${BASE}${path.replace(/^\//, "")}`;
