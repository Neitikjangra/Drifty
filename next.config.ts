import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * @nexconn/chatui bundles parts of Lit compiled against Lit's *production* build
 * (minified internal names like `_$AT`). In `next dev`, Lit resolves its
 * `development` export, whose internals are unminified, and ChatUI's message list
 * crashes ("_$initialize is not a function"). In dev we point Lit's entry points
 * at the production files. Production builds already use them.
 */
function litProductionAliases(): Record<string, string> {
  if (process.env.NODE_ENV === "production") return {};
  try {
    const root = process.cwd();
    const ui = fs.realpathSync(path.join(root, "node_modules/@nexconn/chatui"));
    const lit = fs.realpathSync(path.join(ui, "..", "..", "lit"));
    const sib = (name: string) => fs.realpathSync(path.join(lit, "..", name));
    const rel = (file: string) => `./${path.relative(root, file).split(path.sep).join("/")}`;
    const litHtml = sib("lit-html");
    return {
      lit: rel(path.join(lit, "index.js")),
      "lit-html": rel(path.join(litHtml, "lit-html.js")),
      "lit-html/is-server.js": rel(path.join(litHtml, "is-server.js")),
      "lit-element/lit-element.js": rel(path.join(sib("lit-element"), "lit-element.js")),
      "@lit/reactive-element": rel(path.join(sib("@lit/reactive-element"), "reactive-element.js")),
    };
  } catch {
    return {};
  }
}

/**
 * Security headers on every response (PRD section 7). The CSP only sets directives that can't
 * break ChatUI (no script/connect limits): no framing, no plugins, fixed base and form targets.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Invite links carry a token in the path: never send it on as a referrer.
      { source: "/join/:token*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    resolveAlias: litProductionAliases(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
