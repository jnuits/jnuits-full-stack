"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  publicMemberNavigation,
  publicPrimaryNavigation,
  publicResourceNavigation,
  type NavItem,
} from "@/lib/site";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function PublicNavLink({
  item,
  onNavigate,
  pathname,
}: {
  item: NavItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="site-nav-link"
      data-active={active ? "true" : "false"}
      href={item.href}
      key={item.href}
      onClick={onNavigate}
    >
      {item.label}
    </Link>
  );
}

function NavDropdownMenu({
  items,
  label,
  mode = "desktop",
  onNavigate,
  pathname,
}: {
  items: NavItem[];
  label: string;
  mode?: "desktop" | "mobile";
  onNavigate?: () => void;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const suppressKeyboardClickRef = useRef(false);
  const active = items.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (mode !== "desktop") {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mode]);

  return (
    <div
      className="site-resource-menu"
      data-mode={mode}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
      ref={menuRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup={mode === "desktop" ? "menu" : undefined}
        className="site-nav-link site-resource-menu__trigger"
        data-active={active ? "true" : "false"}
        onClick={() => {
          if (suppressKeyboardClickRef.current) {
            suppressKeyboardClickRef.current = false;
            return;
          }

          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            suppressKeyboardClickRef.current = true;
            window.setTimeout(() => {
              suppressKeyboardClickRef.current = false;
            }, 0);
            setOpen((value) => !value);
          }
        }}
        type="button"
      >
        {label}
        <ChevronDown aria-hidden="true" className="site-resource-menu__chevron" size={15} />
      </button>
      <div
        aria-hidden={!open}
        className="site-resource-menu__panel"
        data-open={open ? "true" : "false"}
        id={menuId}
        role={mode === "desktop" ? "menu" : "group"}
      >
        {items.map((item) => (
          <Link
            className="site-resource-menu__item"
            href={item.href}
            key={item.href}
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            role={mode === "desktop" ? "menuitem" : undefined}
            tabIndex={open ? 0 : -1}
          >
            <span>{item.label}</span>
            {item.description ? <small>{item.description}</small> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function PublicNav({
  mode = "desktop",
  onNavigate,
  pathname,
}: {
  mode?: "desktop" | "mobile";
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <>
      {publicPrimaryNavigation.map((item) => (
        <Fragment key={item.href}>
          {item.href === "/members" ? (
            <NavDropdownMenu
              items={publicMemberNavigation}
              label="Members"
              mode={mode}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ) : (
            <PublicNavLink
              item={item}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          )}
          {item.href === "/events" ? (
            <NavDropdownMenu
              items={publicResourceNavigation}
              label="Resources"
              mode={mode}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePortalReady, setMobilePortalReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMobilePortalReady(true), 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const mobileNavigation = (
    <div
      aria-hidden={mobileOpen ? undefined : true}
      className="site-header-mobile-overlay"
      data-open={mobileOpen ? "true" : "false"}
      onClick={() => setMobileOpen(false)}
    >
      <nav
        aria-label="Mobile navigation"
        className="site-mobile-nav site-header-mobile-panel"
        data-open="true"
        id="mobile-site-navigation"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close navigation menu"
          className="site-mobile-nav__close site-header-mobile-close"
          onClick={() => setMobileOpen(false)}
          type="button"
        >
          <X aria-hidden="true" size={22} />
        </button>
        <PublicNav
          mode="mobile"
          onNavigate={() => setMobileOpen(false)}
          pathname={pathname}
        />
        <div className="mt-4 flex flex-col gap-2">
          <a
            className="primary-button site-header-auth-button text-sm text-center py-2.5 px-4 whitespace-nowrap"
            href="https://forms.gle/s7Eizcv1VyM9mSL27"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
          >
            Join As a Member
          </a>
        </div>
      </nav>
    </div>
  );

  return (
    <header className="site-header site-header-root">
      <div className="shell py-4">
        <div className="site-header-row">
          <SiteBrand displayTitle="JnU IT Society" />
          <nav
            aria-label="Primary navigation"
            className="site-nav site-nav--desktop"
          >
            <PublicNav pathname={pathname} />
          </nav>
          <div className="site-header-actions flex items-center gap-2">
            <ThemeToggle />
            <a
              className="primary-button site-header-auth-button text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap inline-flex items-center justify-center shrink-0"
              href="https://forms.gle/s7Eizcv1VyM9mSL27"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
            >
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Join As a Member</span>
            </a>
            <Link
              className="primary-button site-header-auth-button text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap shrink-0"
              href="/portal/dashboard"
              onClick={() => setMobileOpen(false)}
            >
              Portal
            </Link>
            <button
              aria-controls="mobile-site-navigation"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              className="site-mobile-menu-button shrink-0"
              onClick={() => setMobileOpen((value) => !value)}
              type="button"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {!mobilePortalReady || typeof document === "undefined"
          ? null
          : createPortal(mobileNavigation, document.body)}
      </div>
    </header>
  );
}
