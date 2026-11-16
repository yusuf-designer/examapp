// Packs the server into api/[...path].mjs, the one Vercel function that serves every /api/ call.
// Run `npm run build:api` after changing anything in server/ and commit the result.
import { build } from "esbuild";
await build({
  entryPoints: ["server/vercel.ts"], bundle: true, platform: "node", format: "esm", target: "node20",
  outfile: "api/[...path].mjs", logLevel: "info",
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
