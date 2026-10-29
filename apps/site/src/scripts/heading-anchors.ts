/**
 * A `#` after each docs section heading, linking to it: site.css hides it until the heading is
 * hovered (or the link focused), so a reader can copy a link to a section. Added here rather than
 * in the markdown pipeline: Astro gives headings their ids after every markdown plugin, and its
 * heading list (which search indexes) reads the heading's text, which would then include the `#`.
 */
const startHeadingAnchors = () => {
  for (const heading of document.querySelectorAll<HTMLElement>(".prose :is(h2, h3, h4)[id]")) {
    const link = document.createElement("a");

    link.className = "heading-anchor";
    link.href = `#${heading.id}`;
    link.setAttribute("aria-label", `Link to ${heading.textContent?.trim() ?? "this section"}`);
    link.innerHTML = '<span aria-hidden="true">#</span>';
    heading.append(link);
  }
};

export { startHeadingAnchors };
