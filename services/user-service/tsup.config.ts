import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  minify: false, // Disable minify to preserve class names for DI
  bundle: true,
  noExternal: [/.*/],
  external: [
    // Native modules that can't be bundled
    "bcrypt",
    "cpu-features",
    // Prisma must be external - contains native binaries
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
