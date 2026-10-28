import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowUpRight,
  ArrowUpToLine,
  Bot,
  BookOpen,
  Box,
  Code,
  CornerDownLeft,
  FileText,
  History,
  House,
  Link,
  type LucideIcon,
  Monitor,
  Moon,
  Package,
  Pilcrow,
  Play,
  Sparkles,
  Sun,
  Terminal,
} from "lucide-react";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";

import { url } from "../paths.ts";
import { count, rank, type SearchEntry, type SearchGroup } from "./rank.ts";

/**
 * ⌘K: one box to find anything on the site (every entry in `search.json`) and a few commands. Base
 * UI's Autocomplete inline in a Dialog, as zubin.dev's palette; `rank` does the matching. Dressed
 * as a terminal, like the rest of the site: a prompt, mono chrome, paths on the right and the time
 * the match took. Styles are `.cmdk*` in site.css.
 */

const ICONS: Record<string, LucideIcon> = {
  home: House,
  demo: Play,
  docs: BookOpen,
  agent: Bot,
  section: Pilcrow,
  github: Code,
  npm: Package,
  changelog: History,
  dark: Moon,
  light: Sun,
  system: Monitor,
  link: Link,
  top: ArrowUpToLine,
  install: Terminal,
  skill: Sparkles,
  skills: Sparkles,
};

/** A command: an entry with something to do instead of a place to go. */
export type SearchAction = SearchEntry & { kind: "action"; run: () => void };

export const action = (
  icon: string,
  label: string,
  run: () => void,
  words = "",
  detail?: string,
): SearchAction => ({ kind: "action", icon, label, run, words, ...(detail && { detail }) });

const isAction = (entry: SearchEntry): entry is SearchAction => "run" in entry;

const external = (href: string) => /^https?:/.test(href);

/** What sits on the right of a row: a command's name, a path, or an outside host. */
function where(entry: SearchEntry) {
  if (isAction(entry)) {
    return "run";
  }

  if (!entry.href) {
    return "";
  }

  if (external(entry.href)) {
    return new URL(entry.href).hostname.replace(/^www\./, "");
  }

  return entry.href.replace(/#.*$/, "#…");
}

/** The ranked list and how long ranking took, for the footer's "· 0.42ms". */
function timedRank(entries: readonly SearchEntry[], query: string) {
  const start = performance.now();
  const groups: SearchGroup[] = rank(entries, query);

  return { groups, ms: performance.now() - start };
}

function Mark({ entry }: { entry: SearchEntry }) {
  // A package wears its own lemon mark.
  if (entry.kind === "package") {
    return (
      <span className="cmdk-mark">
        <img src={url(`${entry.label}/favicon.svg`)} alt="" width="18" height="18" />
      </span>
    );
  }

  const Icon =
    (entry.icon && ICONS[entry.icon]) ||
    (isAction(entry) ? Terminal : entry.kind === "page" ? FileText : Box);

  return (
    <span className="cmdk-mark">
      <Icon size={15} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="cmdk-kbd">{children}</kbd>;
}

export function CommandMenu({
  open,
  onOpenChange,
  entries,
  actions = [],
  go,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `search.json`'s, or none while it loads. */
  entries: readonly SearchEntry[] | undefined;
  actions?: readonly SearchAction[];
  /** Goes to a site path or opens an outside link. */
  go: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const hintId = useId();
  // A command runs once the palette has closed, so focus going back can't undo what it did.
  const pending = useRef<() => void>(undefined);

  const all = useMemo(() => [...actions, ...(entries ?? [])], [actions, entries]);
  const { groups, ms } = useMemo(() => timedRank(all, query), [all, query]);
  const rows = count(groups);

  // Each opening starts afresh: closing clears the box.
  const change = (next: boolean) => {
    if (!next) {
      setQuery("");
    }

    onOpenChange(next);
  };

  const choose = (entry: SearchEntry) => {
    change(false);

    if (isAction(entry)) {
      pending.current = entry.run;

      return;
    }

    const { href } = entry;

    if (href) {
      pending.current = () => go(href);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={change}
      onOpenChangeComplete={(opened) => {
        if (!opened) {
          pending.current?.();
          pending.current = undefined;
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="cmdk-scrim" />
        <Dialog.Popup aria-label="Search three-kit" className="cmdk">
          <Autocomplete.Root
            open
            inline
            items={groups}
            filteredItems={groups}
            value={query}
            onValueChange={setQuery}
            autoHighlight="always"
            keepHighlight
            itemToStringValue={(entry: SearchEntry) => entry.label}
          >
            {/* a terminal's title bar */}
            <div className="cmdk-title">
              <span className="cmdk-lights" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="cmdk-title__text">zkmake@three-kit: ~/docs</span>
              <span className="cmdk-title__pad" aria-hidden />
            </div>

            <div className="cmdk-prompt">
              <span className="cmdk-prompt__sign" aria-hidden>
                ❯
              </span>
              <Autocomplete.Input
                aria-label="Search packages, docs, APIs and links"
                aria-describedby={hintId}
                placeholder="search packages, docs, APIs… or > for commands"
                spellCheck={false}
                autoComplete="off"
                className="cmdk-input"
              />
              <Dialog.Close className="cmdk-close" aria-label="Close search">
                <Kbd>esc</Kbd>
              </Dialog.Close>
            </div>

            <div className="cmdk-results">
              {!entries && (
                <p className="cmdk-note">
                  loading index<span className="cmdk-caret">…</span>
                </p>
              )}
              <Autocomplete.Empty>
                <div className="cmdk-empty">
                  <p>
                    <span className="cmdk-empty__shell">zsh:</span> no matches found: {query}
                  </p>
                  <p className="cmdk-empty__hint">
                    try fewer words, an API name like <span>installAuditHelpers</span>, or{" "}
                    <span>&gt;</span> for commands
                  </p>
                </div>
              </Autocomplete.Empty>
              <Autocomplete.List>
                {(group: SearchGroup) => (
                  <Autocomplete.Group key={group.value} items={group.items} className="cmdk-group">
                    <Autocomplete.GroupLabel className="cmdk-group__label">
                      <span>// {group.value}</span>
                      <span className="cmdk-group__rule" aria-hidden />
                      <span>{group.items.length}</span>
                    </Autocomplete.GroupLabel>
                    <Autocomplete.Collection>
                      {(entry: SearchEntry) => (
                        <Autocomplete.Item
                          key={`${entry.kind}:${entry.label}:${entry.href ?? ""}`}
                          value={entry}
                          onClick={() => choose(entry)}
                          className="cmdk-item"
                        >
                          <Mark entry={entry} />
                          <span className="cmdk-item__text">
                            <span className="cmdk-item__label">{entry.label}</span>
                            {entry.detail && (
                              <span className="cmdk-item__detail">{entry.detail}</span>
                            )}
                          </span>
                          <span className="cmdk-item__where">
                            {where(entry)}
                            {entry.href && external(entry.href) && (
                              <ArrowUpRight size={12} aria-hidden />
                            )}
                          </span>
                          <CornerDownLeft size={14} className="cmdk-item__enter" aria-hidden />
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.Collection>
                  </Autocomplete.Group>
                )}
              </Autocomplete.List>
            </div>

            <div id={hintId} className="cmdk-foot">
              <span className="cmdk-foot__hint">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> move
              </span>
              <span className="cmdk-foot__hint">
                <Kbd>↵</Kbd> open
              </span>
              <span className="cmdk-foot__hint">
                <Kbd>&gt;</Kbd> commands
              </span>
              <span className="cmdk-foot__count" aria-live="polite">
                {rows} result{rows === 1 ? "" : "s"} · {ms < 1 ? ms.toFixed(2) : ms.toFixed(1)}ms
              </span>
            </div>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
