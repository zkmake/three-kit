/**
 * The hero's code card (HeroCode.astro): tabs with arrow keys, a vanilla/r3f switch (remembered),
 * and a tour that moves to the next library every few seconds, its progress a ring on the active
 * tab. The tour waits while the pointer or focus is on the card, stops once someone picks a tab or
 * presses pause (play resumes it; the pause lasts the visit), and starts paused under reduced
 * motion. The card fits the snippet on show; the space around it keeps the tallest one's height,
 * so nothing below moves.
 */
import { FLAVOR_STORAGE_KEY, TOUR_PAUSED_KEY } from "./keys.ts";

const TOUR_MS = 5000;

/** A pause holds for the rest of the visit. */
const readPaused = () => {
  try {
    return sessionStorage.getItem(TOUR_PAUSED_KEY) === "1";
  } catch {
    return false;
  }
};

const writePaused = (paused: boolean) => {
  try {
    sessionStorage.setItem(TOUR_PAUSED_KEY, paused ? "1" : "0");
  } catch {
    // The pause still holds on this page.
  }
};
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

/** Shows `flavor`'s snippets and checks its switch option; `onChange` after each pick. */
const startFlavor = (root: HTMLElement, onChange: () => void) => {
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
        onChange();

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

  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")!)!);
  const box = root.querySelector<HTMLElement>(".hero-code__panels")!;
  const frame = root.parentElement!;
  const pause = root.querySelector<HTMLButtonElement>(".hero-code__pause")!;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;
  let touring = !still.matches && !readPaused();
  let held = false;
  let timer = 0;

  /**
   * The frame keeps the tallest snippet's card height (all panels stacked), so the page below
   * never moves; the panels' box then shrinks to the one showing.
   */
  const fit = () => {
    box.style.height = "";
    frame.style.minHeight = "";
    frame.style.minHeight = `${Math.ceil(root.getBoundingClientRect().height)}px`;
    box.style.height = `${panels[current]!.offsetHeight}px`;
  };

  startFlavor(root, fit);

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

    box.style.height = `${panels[current]!.offsetHeight}px`;
  };

  const schedule = () => {
    window.clearTimeout(timer);
    root.classList.toggle("is-touring", touring && !held);
    pause.setAttribute("aria-pressed", String(!touring));
    pause.setAttribute("aria-label", touring ? "Pause the tour" : "Play the tour");

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

  pause.addEventListener("click", () => {
    touring = !touring;
    writePaused(!touring);

    if (touring) {
      // Pressing play means play now, though the pointer and focus are on the card.
      held = false;
      show(current + 1);
    }

    schedule();
  });

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
  root.addEventListener("focusin", (event) => {
    if (event.target !== pause) {
      hold(true);
    }
  });
  root.addEventListener("focusout", (event) => hold(root.contains(event.relatedTarget as Node)));
  still.addEventListener("change", () => {
    if (still.matches) {
      stopTour();
    }
  });

  show(0);
  fit();
  schedule();
  window.addEventListener("resize", fit);
  void document.fonts?.ready.then(fit);
};

export { startHeroCode };
