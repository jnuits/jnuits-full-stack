"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { SiteBrand } from "@/components/layout/site-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  publicMemberNavigation,
  publicPrimaryNavigation,
  publicResourceNavigation,
  type NavItem,
} from "@/lib/site";
import { createClient } from "@/lib/supabase/client";

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
  onNavigate,
  pathname,
}: {
  items: NavItem[];
  label: string;
  onNavigate?: () => void;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const active = items.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div
      className="site-resource-menu"
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
        aria-haspopup="menu"
        className="site-nav-link site-resource-menu__trigger"
        data-active={active ? "true" : "false"}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {label}
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      <div
        className="site-resource-menu__panel"
        data-open={open ? "true" : "false"}
        id={menuId}
        role="menu"
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
            role="menuitem"
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
  onNavigate,
  pathname,
}: {
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
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

export function SiteHeader({
  authenticated: initialAuthenticated = false,
}: {
  authenticated?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const authHref = authenticated ? "/portal/dashboard" : "/portal/login";
  const authLabel = authenticated ? "Portal" : "Sign In";

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setAuthenticated(Boolean(data.session));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthenticated(Boolean(session));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="site-header">
      <div className="shell py-4">
        <div className="site-header-row">
          <SiteBrand displayTitle="JnU IT Society" />
          <nav
            aria-label="Primary navigation"
            className="site-nav site-nav--desktop"
          >
            <PublicNav pathname={pathname} />
          </nav>
          <div className="site-header-actions">
            <ThemeToggle />
            <Link
              className="primary-button site-header-auth-button text-sm"
              href={authHref}
              onClick={() => setMobileOpen(false)}
            >
              {authLabel}
            </Link>
            <button
              aria-controls="mobile-site-navigation"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              className="site-mobile-menu-button"
              onClick={() => setMobileOpen((value) => !value)}
              type="button"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="site-mobile-nav"
          data-open={mobileOpen ? "true" : "false"}
          id="mobile-site-navigation"
        >
          <PublicNav
            onNavigate={() => setMobileOpen(false)}
            pathname={pathname}
          />
        </nav>
      </div>
    </header>
  );
}
