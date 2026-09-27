/** Swap `key` on `target` for `value`; the returned function puts back exactly what was there. */
export const patch = <Target extends object, Key extends keyof Target>(
  target: Target,
  key: Key,
  value: Target[Key],
) => {
  const own = Object.hasOwn(target, key);
  const original = target[key];

  target[key] = value;

  return () => {
    if (own) {
      target[key] = original;
    } else {
      delete target[key];
    }
  };
};
