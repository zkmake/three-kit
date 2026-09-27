/**
 * Copy text from a click handler. The async Clipboard API needs a secure
 * context and the `clipboard-write` permission; a dev server opened over a LAN
 * IP has neither, and some embeds deny the permission. The fallback is the old
 * select-a-textarea `execCommand("copy")`, still honoured inside a user gesture.
 */
const copyWithSelection = (text: string) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  const previous = document.activeElement as HTMLElement | null;
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previous?.focus?.();
  }
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    return copyWithSelection(text);
  }
};

export { copyText };
