/**
 * Hides groups of scene objects to measure what they cost, and puts every one
 * back exactly as it was. Objects are three objects, read structurally: only
 * `visible` is touched.
 *
 * An object can sit in two hidden groups at once (a mesh row and its
 * material's row); it stays hidden until the last group that holds it is
 * shown again. Objects that were already invisible stay invisible.
 */
type Hideable = { visible?: boolean };

class Hider {
  private readonly groups = new Map<string, Hideable[]>();
  /** Each hidden object's `visible` from before the first group hid it. */
  private readonly original = new Map<Hideable, boolean>();

  hide(key: string, objects: readonly unknown[]) {
    if (this.groups.has(key)) {
      return;
    }

    const hideable = objects.filter(
      (object): object is Hideable => typeof object === "object" && object !== null,
    );
    this.groups.set(key, hideable);

    for (const object of hideable) {
      if (!this.original.has(object)) {
        this.original.set(object, object.visible !== false);
      }

      object.visible = false;
    }
  }

  show(key: string) {
    const objects = this.groups.get(key);

    if (!objects) {
      return;
    }

    this.groups.delete(key);

    for (const object of objects) {
      if (!this.heldElsewhere(object)) {
        object.visible = this.original.get(object) ?? true;
        this.original.delete(object);
      }
    }
  }

  isHidden(key: string) {
    return this.groups.has(key);
  }

  /** Hidden group keys, in the order they were hidden. */
  keys() {
    return [...this.groups.keys()];
  }

  restoreAll() {
    for (const key of this.keys()) {
      this.show(key);
    }
  }

  private heldElsewhere(object: Hideable) {
    for (const objects of this.groups.values()) {
      if (objects.includes(object)) {
        return true;
      }
    }

    return false;
  }
}

export { Hider };
