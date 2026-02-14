// Downloads the @zoom/rtms prebuilt native binary from GitHub releases.
// Uses only Node.js built-ins (no curl/bash needed) so it works in any Docker build.

import { existsSync, mkdirSync, createWriteStream, readFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import https from "https";
import { pipeline } from "stream/promises";

const RTMS_DIR = "node_modules/@zoom/rtms";
const BINARY = join(RTMS_DIR, "build", "Release", "rtms.node");

function log(msg) {
  console.log(`[rtms-install] ${msg}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "node" } }, (res) => {
      // Follow redirects (GitHub releases redirect to S3)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve, reject);
      }
      resolve(res);
    }).on("error", reject);
  });
}

async function main() {
  if (existsSync(BINARY)) {
    log("Native binary already exists, skipping download");
    return;
  }

  // Detect platform
  const os = process.platform; // "linux" or "darwin"
  const arch = process.arch;   // "x64" or "arm64"
  log(`Platform: ${os}-${arch}`);

  // Read version
  let version;
  try {
    const pkg = JSON.parse(readFileSync(join(RTMS_DIR, "package.json"), "utf8"));
    version = pkg.version;
    log(`@zoom/rtms version: ${version}`);
  } catch {
    log("ERROR: Could not read @zoom/rtms package.json");
    return;
  }

  // Try NAPI v10 then v9
  for (const napi of [10, 9]) {
    const filename = `rtms-v${version}-napi-v${napi}-${os}-${arch}.tar.gz`;
    const url = `https://github.com/zoom/rtms/releases/download/v${version}/${filename}`;
    log(`Trying: ${url}`);

    try {
      const res = await httpGet(url);
      if (res.statusCode !== 200) {
        log(`HTTP ${res.statusCode} — skipping napi-v${napi}`);
        res.resume(); // drain
        continue;
      }

      // Download to temp file
      const tmpFile = `/tmp/rtms-prebuild.tar.gz`;
      await pipeline(res, createWriteStream(tmpFile));
      log(`Downloaded ${filename}`);

      // Extract
      mkdirSync(join(RTMS_DIR, "build", "Release"), { recursive: true });
      execSync(`tar -xzf ${tmpFile} -C ${RTMS_DIR}`, { stdio: "inherit" });

      if (existsSync(BINARY)) {
        log(`Native binary installed at ${BINARY}`);
        return;
      } else {
        log("Extracted but rtms.node not found. Listing build/Release:");
        try {
          const files = execSync(`ls -la ${join(RTMS_DIR, "build", "Release")}`, { encoding: "utf8" });
          log(files);
        } catch {}
      }
    } catch (err) {
      log(`Download failed for napi-v${napi}: ${err.message}`);
    }
  }

  log("WARNING: Could not install prebuilt binary");
}

main().catch((err) => {
  log(`Script error: ${err.message}`);
});
