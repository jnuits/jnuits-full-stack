import { describe, expect, it } from "vitest";

import {
  buildPublicFormUrl,
  formatPublicFormUrlForDisplay,
} from "./public-url";

describe("canonical public form URL", () => {
  it("builds an absolute URL from the configured base", () => {
    expect(
      buildPublicFormUrl({
        baseUrl: "https://jnuits.org.bd",
        slug: "membership-2026",
      })
    ).toBe("https://jnuits.org.bd/forms/membership-2026");
  });

  it("ignores a trailing slash on the base", () => {
    expect(
      buildPublicFormUrl({
        baseUrl: "https://jnuits.org.bd/",
        slug: "membership-2026",
      })
    ).toBe("https://jnuits.org.bd/forms/membership-2026");
  });

  it("discards a path on the base, matching getAppBaseUrl normalisation", () => {
    expect(
      buildPublicFormUrl({
        baseUrl: "https://jnuits.org.bd/admin/content",
        slug: "membership-2026",
      })
    ).toBe("https://jnuits.org.bd/forms/membership-2026");
  });

  it("keeps a non-default port, so local development still works", () => {
    expect(
      buildPublicFormUrl({ baseUrl: "http://localhost:3000", slug: "alumni" })
    ).toBe("http://localhost:3000/forms/alumni");
  });

  it("trims surrounding whitespace on both inputs", () => {
    expect(
      buildPublicFormUrl({
        baseUrl: "  https://jnuits.org.bd  ",
        slug: "  alumni-onboarding  ",
      })
    ).toBe("https://jnuits.org.bd/forms/alumni-onboarding");
  });

  it("encodes a legacy slug containing characters that need escaping", () => {
    // Slugs created through the studio are already slugified, but a historical
    // definition is not guaranteed to be.
    expect(
      buildPublicFormUrl({ baseUrl: "https://jnuits.org.bd", slug: "a b/c" })
    ).toBe("https://jnuits.org.bd/forms/a%20b%2Fc");
  });

  it("returns null for an empty or whitespace-only slug", () => {
    expect(
      buildPublicFormUrl({ baseUrl: "https://jnuits.org.bd", slug: "" })
    ).toBeNull();
    expect(
      buildPublicFormUrl({ baseUrl: "https://jnuits.org.bd", slug: "   " })
    ).toBeNull();
  });

  it("returns null for an empty base rather than guessing an origin", () => {
    expect(buildPublicFormUrl({ baseUrl: "", slug: "membership-2026" })).toBeNull();
  });

  it("returns null for a malformed base", () => {
    expect(
      buildPublicFormUrl({ baseUrl: "not a url", slug: "membership-2026" })
    ).toBeNull();
  });

  it("rejects a non-web protocol", () => {
    // These parse as valid URLs, so the protocol has to be checked explicitly.
    expect(
      buildPublicFormUrl({ baseUrl: "javascript:alert(1)", slug: "x" })
    ).toBeNull();
    expect(buildPublicFormUrl({ baseUrl: "ftp://jnuits.org.bd", slug: "x" })).toBeNull();
    expect(
      buildPublicFormUrl({ baseUrl: "data:text/html,<b>x</b>", slug: "x" })
    ).toBeNull();
  });

  it("never derives an origin of its own", () => {
    // The whole point of the module: no ambient fallback exists, so a caller
    // that forgets to supply the canonical base gets null, not a wrong link.
    expect(buildPublicFormUrl({ baseUrl: "", slug: "membership-2026" })).toBeNull();
    expect(buildPublicFormUrl({ baseUrl: "   ", slug: "membership-2026" })).toBeNull();
  });
});

describe("public form URL display", () => {
  it("drops the scheme for compact display", () => {
    expect(
      formatPublicFormUrlForDisplay("https://jnuits.org.bd/forms/membership-2026")
    ).toBe("jnuits.org.bd/forms/membership-2026");
    expect(formatPublicFormUrlForDisplay("http://localhost:3000/forms/x")).toBe(
      "localhost:3000/forms/x"
    );
  });
});
