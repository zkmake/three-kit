/**
 * Near or far: which copy of something draws, from its distance to the camera. A margin keeps an
 * object sitting on the threshold from flickering between the two.
 */

export type Level = "near" | "far";

export type LevelOptions = {
  /** Beyond this, in world units, the far copy draws. */
  distance: number;
  /** Switch back to near only this much nearer than `distance`. Default 1.5. */
  hysteresis?: number;
};

let pinned: Level | null = null;

/** Pin every level-switched object to one level (a studio's `?lod=far`); `null` goes by distance. */
export const pinLevel = (level: Level | null) => {
  pinned = level;
};

export const pinnedLevel = () => pinned;

/** The level for something `distance` from the camera, given the level it shows now. */
export const levelFor = (distance: number, current: Level, options: LevelOptions): Level => {
  if (pinned) {
    return pinned;
  }

  if (current === "far") {
    return distance < options.distance - (options.hysteresis ?? 1.5) ? "near" : "far";
  }

  return distance > options.distance ? "far" : "near";
};
