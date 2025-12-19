import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  minify: true,
  bundle: true,
  noExternal: [/.*/],
  external: [
    // Native modules that can't be bundled
    "bcrypt",
    "cpu-features",
    "@prisma/client",
    ".prisma/client",
  ],
  esbuildOptions(options) {
    options.keepNames = true;
    options.alias = {
      "@echo/telemetry": "../shared/telemetry/src/index.ts",
      "@echo/logger": "../shared/logger/src/index.ts",
      "@echo/metrics": "../shared/metrics/src/index.ts",
      "@echo/http-client": "../shared/http-client/src/index.ts",
    };
  },
  splitting: false,
  shims: true,
});
