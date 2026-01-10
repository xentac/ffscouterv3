import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

function get_git_version(): string {
  let raw: string;

  try {
    raw = execSync("git describe --tags --dirty --always", {
      encoding: "utf8",
    }).trim();
  } catch {
    return "0.0.0-unknown";
  }

  // Strip leading "v"
  raw = raw.replace(/^v/, "");

  // Extract dirty flag
  const isDirty = raw.endsWith("-dirty");
  if (isDirty) {
    raw = raw.slice(0, -6);
  }

  // If this is just a commit hash
  if (/^[0-9a-f]{7,}$/.test(raw)) {
    return `0.0.0+${raw}${isDirty ? ".dirty" : ""}`;
  }

  // Tagged version with optional commit distance
  // 3.2.1
  // 3.2.1-4-gabcdef
  const match = raw.match(/^(\d+\.\d+\.\d+)(?:-(\d+)-g([0-9a-f]+))?$/);

  if (!match) {
    return `0.0.0+unknown${isDirty ? ".dirty" : ""}`;
  }

  const [, base, commits, hash] = match;

  let version = base || "0.0.0";

  if (commits && hash) {
    version += `+${commits}.g${hash}`;
  }

  if (isDirty) {
    version += version.includes("+") ? ".dirty" : "+dirty";
  }

  return version;
}
export default defineConfig(({ mode }) => {
  const isDev = mode === "dev";

  const version = get_git_version();

  return {
    plugins: [
      monkey({
        entry: "src/index.ts",
        build: {
          fileName: isDev ? "base-dev.user.js" : "base.user.js",
        },
        userscript: {
          name: "FF Scouter V3",
          author: "xentac [3354782], MAVRI [2402357]",
          description:
            "Shows the expected Fair Fight score against targets and faction war status",
          copyright: "2026, xentac",
          version: version,
          namespace: "xentac",
          license: "GPLv3",
          match: ["https://www.torn.com/*"],
          "run-at": "document-start", // This has to be "document-start" to intercept http & ws
        },
      }),
    ],
    resolve: {
      alias: {
        "@ui": path.resolve(__dirname, "src/ui"),
        "@utils": path.resolve(__dirname, "src/utils"),
        "@features": path.resolve(__dirname, "src/features"),
      },
    },
    build: {
      minify: false,
    },
  };
});
