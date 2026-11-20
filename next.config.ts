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

const nextConfig: NextConfig = {
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
