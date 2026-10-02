/**
 * The landing cards' demo clips (CardMedia.astro): each plays while it's on screen and pauses
 * when it isn't. Under reduced motion they stay on their poster.
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

export { startCardMedia };
