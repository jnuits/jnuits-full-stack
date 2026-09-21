"use client";

import { useState, useEffect, useRef, useId, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ArrowRight,
  Sparkles,
  BarChart2,
  BellRing,
  BookOpen,
  ClipboardList,
  FileCode2,
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  Mail,
  Phone,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  UserCheck,
} from "lucide-react";
import type { AdminShellNavigationItem } from "./admin-shell";

const iconByKey = {
  barChart: BarChart2,
  bell: BellRing,
  book: BookOpen,
  clipboard: ClipboardList,
  code: FileCode2,
  dashboard: LayoutDashboard,
  file: FileText,
  folder: FolderOpen,
  image: ImageIcon,
  mail: Mail,
  phone: Phone,
  refresh: RefreshCcw,
  scroll: ScrollText,
  shield: ShieldCheck,
  userCheck: UserCheck,
  userCog: UserCog,
  users: Users,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  navigationItems: AdminShellNavigationItem[];
}

export function AdminCommandPalette({
  isOpen,
  onClose,
  navigationItems,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navigationItems;
    return navigationItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [navigationItems, query]);

  const handleClose = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    return () => {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Body scroll lock & Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0
            ? (prev - 1 + filteredItems.length) % filteredItems.length
            : 0
        );
      } else if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === "Enter") {
        if (filteredItems.length > 0 && filteredItems[selectedIndex]) {
          event.preventDefault();
          const target = filteredItems[selectedIndex].href;
          handleClose();
          router.push(target);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, filteredItems, selectedIndex, router, handleClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeElement = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (activeElement && typeof activeElement.scrollIntoView === "function") {
      activeElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="admin-cmd-palette-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Admin command palette"
    >
      <div
        ref={dialogRef}
        className="admin-cmd-palette-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-cmd-palette-search">
          <Search className="admin-cmd-palette-icon" size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="admin-cmd-palette-input"
            placeholder="Search pages, settings, and sections... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              filteredItems[selectedIndex]
                ? `cmd-item-${filteredItems[selectedIndex].href}`
                : undefined
            }
          />
          {query ? (
            <button
              type="button"
              className="admin-cmd-palette-clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
              }}
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="admin-cmd-palette-kbd">ESC</kbd>
          )}
        </div>

        <div
          ref={listRef}
          id={listId}
          className="admin-cmd-palette-list"
          role="listbox"
          aria-label="Command palette options"
        >
          {filteredItems.length === 0 ? (
            <div className="admin-cmd-palette-empty">
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <span>Try searching for &ldquo;dashboard&rdquo;, &ldquo;membership&rdquo;, or &ldquo;content&rdquo;</span>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = iconByKey[item.iconKey] || LayoutDashboard;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.href}
                  id={`cmd-item-${item.href}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className="admin-cmd-palette-item"
                  data-selected={isSelected ? "true" : "false"}
                  onClick={() => {
                    handleClose();
                    router.push(item.href);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="admin-cmd-palette-item__icon" aria-hidden="true">
                    <Icon size={16} />
                  </div>
                  <div className="admin-cmd-palette-item__content">
                    <span className="admin-cmd-palette-item__label">
                      {item.label}
                    </span>
                    <span className="admin-cmd-palette-item__group">
                      {item.group}
                    </span>
                  </div>
                  {isSelected && (
                    <ArrowRight
                      size={14}
                      className="admin-cmd-palette-item__arrow"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="admin-cmd-palette-footer">
          <div className="admin-cmd-palette-footer__hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>esc</kbd> Dismiss</span>
          </div>
          <div className="admin-cmd-palette-footer__role">
            <Sparkles size={12} className="text-[var(--brand-gold)]" />
            <span>Fast Operator Jump</span>
          </div>
        </div>
      </div>
    </div>
  );
}
