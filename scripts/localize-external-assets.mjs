#!/usr/bin/env node
/**
 * Localize external *.asset.json platform URLs for self-hosted production builds.
 *
 * Some builder exports commit src/assets/*.asset.json with /__l5e/assets-v1/ URLs. This script
 * keeps those files as source metadata in git while serving repo-owned
 * binaries from public/site-assets/ at build time.
 *
 * Modes:
 *   --sync         Download/update binaries + manifest (run after external asset changes)
 *   --verify       Fail if binaries or manifest are stale vs src/assets/*.asset.json
 *   --rewrite-json Temporarily rewrite asset JSON urls for build (working tree only)
 *   --restore-json Restore asset JSON from backup or git
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "src");
const SITE_ASSETS_DIR = join(ROOT, "public", "site-assets");
const MANIFEST_PATH = join(SITE_ASSETS_DIR, ".asset-manifest.json");
const BACKUP_DIR = join(ROOT, "src", "assets", ".asset-backup");
const PLATFORM_URL = /^\/__l5e\/assets-v1\//;
const LOCAL_URL_PREFIX = "/site-assets";

const ORIGINS = [...new Set([process.env.EXTERNAL_ASSET_ORIGIN].filter(Boolean))];

const flags = {
  sync: process.argv.includes("--sync"),
  verify: process.argv.includes("--verify"),
  rewriteJson: process.argv.includes("--rewrite-json"),
  restoreJson: process.argv.includes("--restore-json"),
};

if (!flags.sync && !flags.verify && !flags.rewriteJson && !flags.restoreJson) {
  console.error(
    "Usage: node scripts/localize-external-assets.mjs (--sync | --verify | --rewrite-json | --restore-json)",
  );
  process.exit(1);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(message);
}

async function findAssetJsonFiles(dir) {
  const results = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".asset-backup") continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".asset.json")) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

async function sha256File(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function loadManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { version: 1, assets: {} };
    }
    throw error;
  }
}

async function saveManifest(manifest) {
  await mkdir(SITE_ASSETS_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function readAssetRecord(jsonPath) {
  const meta = JSON.parse(await readFile(jsonPath, "utf8"));
  const fileName = meta.original_filename ?? basename(meta.url ?? jsonPath);
  const localPath = join(SITE_ASSETS_DIR, fileName);
  const publicUrl = `${LOCAL_URL_PREFIX}/${fileName}`;
  const relJson = relative(ROOT, jsonPath).split("\\").join("/");

  return {
    jsonPath,
    relJson,
    meta,
    fileName,
    localPath,
    publicUrl,
    needsLocalization: PLATFORM_URL.test(meta.url ?? ""),
  };
}

async function downloadAsset(meta, destPath) {
  let lastError = "no origins succeeded";

  for (const origin of ORIGINS) {
    const base = origin.replace(/\/$/, "");
    const url = `${base}${meta.url}`;

    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        lastError = `${url} -> HTTP ${response.status}`;
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (meta.size && buffer.length !== meta.size) {
        lastError = `${url} -> size ${buffer.length}, expected ${meta.size}`;
        continue;
      }

      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, buffer);

      return {
        ok: true,
        origin: base,
        size: buffer.length,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return { ok: false, error: lastError };
}

function manifestEntry(record, sha256) {
  return {
    json: record.relJson,
    file: record.fileName,
    publicUrl: record.publicUrl,
    size: record.meta.size ?? null,
    sha256,
    createdAt: record.meta.created_at ?? null,
  };
}

async function syncAssets(records) {
  const manifest = await loadManifest();
  manifest.version = 1;
  manifest.assets ??= {};

  const localized = records.filter((record) => record.needsLocalization);
  if (localized.length === 0) {
    info("No external platform asset JSON files found to sync.");
    return;
  }

  for (const record of localized) {
    const { meta, localPath, fileName } = record;
    const assetId = meta.asset_id;
    if (!assetId) {
      fail(`${record.relJson} is missing asset_id`);
    }

    const existing = manifest.assets[assetId];
    let fileStat = null;

    try {
      fileStat = await stat(localPath);
    } catch {
      fileStat = null;
    }

    const fileSha256 = fileStat ? await sha256File(localPath) : null;
    const manifestMatches =
      existing &&
      existing.file === fileName &&
      existing.size === meta.size &&
      (!existing.sha256 || existing.sha256 === fileSha256);

    if (fileStat && manifestMatches && fileStat.size === meta.size) {
      manifest.assets[assetId] = manifestEntry(record, fileSha256);
      info(`OK ${fileName} (already synced)`);
      continue;
    }

    info(`Downloading ${fileName}...`);
    const result = await downloadAsset(meta, localPath);
    if (!result.ok) {
      fail(
        `Failed to download ${fileName} from external origins (${ORIGINS.join(", ")}): ${result.error}`,
      );
    }

    manifest.assets[assetId] = manifestEntry(record, result.sha256);
    info(`OK ${fileName} (${result.size} bytes from ${result.origin})`);
  }

  const activeIds = new Set(localized.map((record) => record.meta.asset_id));
  for (const assetId of Object.keys(manifest.assets)) {
    if (!activeIds.has(assetId)) {
      delete manifest.assets[assetId];
    }
  }

  await saveManifest(manifest);
}

async function verifyAssets(records) {
  const localized = records.filter((record) => record.needsLocalization);
  if (localized.length === 0) {
    info("No external platform asset JSON files require localization.");
    return;
  }

  const manifest = await loadManifest();

  for (const record of localized) {
    const { meta, localPath, fileName, relJson, publicUrl } = record;
    const assetId = meta.asset_id;

    if (!assetId) {
      fail(`${relJson} is missing asset_id`);
    }

    let fileStat;
    try {
      fileStat = await stat(localPath);
    } catch {
      fail(
        `Missing localized asset file ${relative(ROOT, localPath)} for ${relJson}. Run: npm run assets:sync`,
      );
    }

    if (meta.size && fileStat.size !== meta.size) {
      fail(
        `${fileName} size ${fileStat.size} does not match ${relJson} metadata (${meta.size}). Run: npm run assets:sync`,
      );
    }

    const fileSha256 = await sha256File(localPath);
    const entry = manifest.assets?.[assetId];

    if (!entry) {
      fail(`Manifest missing asset_id ${assetId} for ${relJson}. Run: npm run assets:sync`);
    }

    if (entry.file !== fileName) {
      fail(`Manifest file mismatch for ${assetId}: expected ${fileName}, got ${entry.file}`);
    }

    if (entry.publicUrl !== publicUrl) {
      fail(
        `Manifest publicUrl mismatch for ${assetId}: expected ${publicUrl}, got ${entry.publicUrl}`,
      );
    }

    if (entry.size != null && entry.size !== meta.size) {
      fail(`Manifest size mismatch for ${assetId}: expected ${meta.size}, got ${entry.size}`);
    }

    if (entry.sha256 && entry.sha256 !== fileSha256) {
      fail(`${fileName} sha256 does not match manifest for ${assetId}. Run: npm run assets:sync`);
    }

    info(`OK ${relJson} -> ${publicUrl}`);
  }
}

async function rewriteAssetJson(records) {
  await mkdir(BACKUP_DIR, { recursive: true });

  for (const record of records) {
    if (!record.needsLocalization) continue;

    const backupPath = join(BACKUP_DIR, basename(record.jsonPath));
    await copyFile(record.jsonPath, backupPath);

    const localized = {
      ...record.meta,
      url: record.publicUrl,
    };

    await writeFile(record.jsonPath, `${JSON.stringify(localized, null, 2)}\n`, "utf8");
    info(`Localized ${record.relJson} -> ${record.publicUrl}`);
  }
}

async function restoreAssetJson(records) {
  let restored = 0;

  for (const record of records) {
    const backupPath = join(BACKUP_DIR, basename(record.jsonPath));
    try {
      await copyFile(backupPath, record.jsonPath);
      restored += 1;
      info(`Restored ${record.relJson} from backup`);
    } catch {
      // Fall back to git restore below.
    }
  }

  if (restored === 0) {
    try {
      execSync("git restore src/assets/*.asset.json", {
        cwd: ROOT,
        stdio: "pipe",
      });
      info("Restored src/assets/*.asset.json from git");
    } catch (error) {
      const message = error instanceof Error ? error.message : "git restore failed";
      fail(`Could not restore asset JSON files from backup or git: ${message}`);
    }
  }

  await rm(BACKUP_DIR, { recursive: true, force: true });
}

async function main() {
  const jsonPaths = await findAssetJsonFiles(SRC_DIR);
  const records = await Promise.all(jsonPaths.map(readAssetRecord));

  if (flags.sync) {
    await syncAssets(records);
  }

  if (flags.verify) {
    await verifyAssets(records);
  }

  if (flags.rewriteJson) {
    await rewriteAssetJson(records);
  }

  if (flags.restoreJson) {
    await restoreAssetJson(records);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
