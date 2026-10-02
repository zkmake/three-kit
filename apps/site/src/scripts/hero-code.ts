/**
 * The hero's code card (HeroCode.astro): tabs with arrow keys, a vanilla/r3f switch (remembered),
 * and a tour that moves to the next library every few seconds. The tour waits while the pointer or
 * focus is on the card, stops for good once someone picks a tab, and never runs under reduced
 * motion.
 */
import { FLAVOR_STORAGE_KEY } from "./keys.ts";

const TOUR_MS = 5000;
const FLAVORS = ["vanilla", "r3f"] as const;

type Flavor = (typeof FLAVORS)[number];

const isFlavor = (value: unknown): value is Flavor => FLAVORS.includes(value as Flavor);

const readFlavor = (): Flavor => {
  try {
    const stored = localStorage.getItem(FLAVOR_STORAGE_KEY);

    return isFlavor(stored) ? stored : "vanilla";
  } catch {
    return "vanilla";
  }
};

/** Shows `flavor`'s snippets and checks its switch option. */
const startFlavor = (root: HTMLElement) => {
  const options = [...root.querySelectorAll<HTMLButtonElement>("[data-flavor]")].filter(
    (element) => element !== root,
  );

  const show = (flavor: Flavor) => {
    root.dataset.flavor = flavor;

    for (const option of options) {
      option.setAttribute("aria-checked", String(option.dataset.flavor === flavor));
    }
  };

  for (const option of options) {
    option.addEventListener("click", () => {
      const flavor = option.dataset.flavor;

      if (isFlavor(flavor)) {
        show(flavor);

        try {
          localStorage.setItem(FLAVOR_STORAGE_KEY, flavor);
        } catch {
          // The pick still applies to this page.
        }
      }
    });
  }

  show(readFlavor());
};

const startHeroCode = () => {
  const root = document.querySelector<HTMLElement>("[data-hero-code]");

  if (!root) {
    return;
  }

  startFlavor(root);

  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")!)!);
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;
  let touring = !still.matches;
  let held = false;
  let timer = 0;

  const show = (index: number, focus = false) => {
    current = (index + tabs.length) % tabs.length;

    tabs.forEach((tab, i) => {
      const on = i === current;

      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i]!.hidden = !on;
    });

    if (focus) {
      tabs[current]!.focus();
    }
  };

  const schedule = () => {
    window.clearTimeout(timer);
    root.classList.toggle("is-touring", touring && !held);

    if (touring && !held) {
      // Restart the progress bar's animation for this step.
      root.classList.remove("is-ticking");
      void root.offsetWidth;
      root.classList.add("is-ticking");
      timer = window.setTimeout(() => {
        show(current + 1);
        schedule();
      }, TOUR_MS);
    }
  };

  const stopTour = () => {
    touring = false;
    schedule();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      stopTour();
      show(index);
    });
  });

  root.addEventListener("keydown", (event) => {
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") {
      return;
    }

    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];

    if (step) {
      event.preventDefault();
      stopTour();
      show(current + step, true);
    }
  });

  const hold = (on: boolean) => {
    held = on;
    schedule();
  };

  root.addEventListener("pointerenter", () => hold(true));
  root.addEventListener("pointerleave", () => hold(root.contains(document.activeElement)));
  root.addEventListener("focusin", () => hold(true));
  root.addEventListener("focusout", (event) => hold(root.contains(event.relatedTarget as Node)));
  still.addEventListener("change", () => {
    if (still.matches) {
      stopTour();
    }
  });

  show(0);
  schedule();
};

export { startHeroCode };
