/**
 * Where the site lives: under `/three-kit/` on zubin.dev, so every link, asset and fetch goes
 * through `url()` rather than starting at the domain root, which zubin.dev owns.
 */

/** The base the site is built under, with a trailing slash: `/three-kit/`. */
export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

/** A path on the site: `url("three-meter/")` is `/three-kit/three-meter/`, `url()` the home page. */
export const url = (path = "") => `${BASE}${path.replace(/^\//, "")}`;
