import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const fixtures = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "jnuits-next-lint-glob-"));
  fixtures.push(root);
  for (const dir of ["one/app/about", "one/nested", "two/src/pages", ".hidden/app"]) {
    mkdirSync(join(root, "packages", dir), { recursive: true });
  }
  writeFileSync(join(root, "packages/one/app/about/page.tsx"), "export default function Page() { return null; }\n");
  writeFileSync(join(root, "packages/one/app/page.tsx"), "export default function Page() { return null; }\n");
  writeFileSync(join(root, "packages/two/src/pages/contact.tsx"), "export default function Page() { return null; }\n");
  writeFileSync(join(root, "packages/not-a-directory"), "fixture\n");
  return root.replaceAll("\\", "/");
}

function roots(pattern) {
  const { getRootDirs } = require("@next/eslint-plugin-next/dist/utils/get-root-dirs");
  return getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: pattern } } })
    .map(dir => dir.replace(/\/$/, "")).sort();
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Next lint root discovery without the vulnerable brace parser", () => {
  it("loads the actual Next linter without any braces or micromatch dependency", () => {
    // Instrument module loading, not the lint result: never substitute a fake
    // parser or rule. Reintroducing the vulnerable chain must fail this test.
    const source = `
      const Module = require('node:module');
      const load = Module._load;
      Module._load = function(id, ...args) {
        if (id === 'braces' || id === 'micromatch') throw new Error('Vulnerable lint dependency loaded: ' + id);
        return load.call(this, id, ...args);
      };
      const { Linter } = require('eslint');
      const plugin = require('@next/eslint-plugin-next');
      const messages = new Linter().verify('const image = <img src="photo.png" alt="Photo" />;', [{
        languageOptions: { parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } } },
        plugins: { '@next/next': plugin },
        rules: { '@next/next/no-img-element': 'error' }
      }]);
      console.log(JSON.stringify(messages.map(message => message.ruleId)));
    `;
    const result = spawnSync(process.execPath, ["-e", source], { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(["@next/next/no-img-element"]);
  });

  it("keeps a literal root as one directory instead of expanding descendants", () => {
    const root = fixture();
    expect(roots(`${root}/packages/one/`)).toEqual([`${root}/packages/one`]);
    expect(roots(`${root}/packages/not-a-directory`)).toEqual([]);
  });

  it("discovers wildcard roots without files or hidden directories", () => {
    const root = fixture();
    expect(roots(`${root}/packages/*/`)).toEqual([`${root}/packages/one`, `${root}/packages/two`]);
  });

  it("preserves relative root results and the default working directory", () => {
    const root = fixture();
    const pattern = `${relative(process.cwd(), root).replaceAll("\\", "/")}/packages/one`;
    expect(roots(pattern)).toEqual([pattern]);
    expect(roots(undefined)).toEqual([process.cwd()]);
  });

  it("preserves brace alternatives, arrays and Windows path normalization", () => {
    const root = fixture();
    expect(roots(`${root}/packages/{one,two}/`)).toEqual([`${root}/packages/one`, `${root}/packages/two`]);
    expect(roots([`${root}/packages/one`, `${root}/packages/two`, 17])).toEqual([`${root}/packages/one`, `${root}/packages/two`]);
    expect(roots(`${root}/packages/one`.replaceAll("/", "\\"))).toEqual([`${root}/packages/one`]);
    expect(roots(`${root}/missing/*`)).toEqual([]);
  });

  it("still rejects internal anchor navigation in discovered App and Pages roots", () => {
    const root = fixture();
    const { Linter } = require("eslint");
    const plugin = require("@next/eslint-plugin-next");
    const config = [{
      languageOptions: { parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": plugin },
      settings: { next: { rootDir: `${root}/packages/*/` } },
      rules: { "@next/next/no-html-link-for-pages": "error" },
    }];
    const linter = new Linter();
    const rejected = linter.verify('const links = <><a href="/">Home</a><a href="/contact">Contact</a></>;', config);
    expect(rejected.map(message => message.ruleId)).toEqual([
      "@next/next/no-html-link-for-pages", "@next/next/no-html-link-for-pages",
    ]);
    expect(linter.verify('const links = <><Link href="/about">About</Link><a href="https://example.test">External</a></>;', config)).toEqual([]);
  });
});
