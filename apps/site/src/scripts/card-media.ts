/**
 * The landing cards: their demo clips (CardMedia.astro) play while on screen and pause when not,
 * and stay on their poster under reduced motion; their hover glow follows the pointer.
 */
const startCardMedia = () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const videos = [...document.querySelectorAll<HTMLVideoElement>("[data-card-video]")];
  const watch = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const video = target as HTMLVideoElement;

        if (isIntersecting) {
          // Autoplay can still be refused (data saver); the poster stays.
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    },
    { rootMargin: "120px 0px" },
  );

  for (const video of videos) {
    watch.observe(video);
  }
};

/** The cards' hover glow sits under the pointer: `--mx`/`--my` on the card, read by site.css. */
const startCardGlow = () => {
  for (const card of document.querySelectorAll<HTMLElement>(".card")) {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();

      card.style.setProperty("--mx", `${event.clientX - box.left}px`);
      card.style.setProperty("--my", `${event.clientY - box.top}px`);
    });
  }
};

export { startCardGlow, startCardMedia };
