/** localStorage keys, one of each for the whole site. Base.astro's inline script reads the theme. */
const THEME_STORAGE_KEY = "three-kit:theme";
/** The install commands' package manager: a pick on any card applies to all of them. */
const PM_STORAGE_KEY = "three-kit:pm";
/** The landing code card's flavor: plain three or React Three Fiber. */
const FLAVOR_STORAGE_KEY = "three-kit:flavor";

export { FLAVOR_STORAGE_KEY, PM_STORAGE_KEY, THEME_STORAGE_KEY };
