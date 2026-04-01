#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const README_PT = path.join(ROOT, "README.md");
const README_EN = path.join(ROOT, "README.en.md");
const SOURCE_TREE = path.join(ROOT, "config", "source-tree.md");
const SQUAD = path.join(ROOT, "squad.yaml");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function parseSquadMeta() {
  const text = read(SQUAD);
  const version = (text.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)/m) || [])[1] || "0.0.0";
  const constitution =
    (text.match(/constitutionVersion:\s*"([^"]+)"/m) || [])[1] || "v0";
  return { version, constitution };
}

function countFilesRecursive(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      if (rel.startsWith("reports/validation-history")) continue;
      count += countFilesRecursive(full);
    }
    else count += 1;
  }
  return count;
}

function validate() {
  const issues = [];
  const { version, constitution } = parseSquadMeta();
  const pt = read(README_PT);
  const en = read(README_EN);
  const srcTree = read(SOURCE_TREE);

  const ptVersion = (pt.match(/badge\/version-([0-9]+\.[0-9]+\.[0-9]+)-/m) || [])[1];
  const enVersion = (en.match(/badge\/version-([0-9]+\.[0-9]+\.[0-9]+)-/m) || [])[1];
  if (ptVersion !== version) {
    issues.push({
      code: "DOC_001",
      severity: "high",
      file: "README.md",
      message: `Badge version ${ptVersion || "N/A"} difere de squad.yaml (${version}).`,
    });
  }
  if (enVersion !== version) {
    issues.push({
      code: "DOC_001",
      severity: "high",
      file: "README.en.md",
      message: `Badge version ${enVersion || "N/A"} difere de squad.yaml (${version}).`,
    });
  }

  const constitutionMentionRegex = new RegExp(`\\(\\s*\`?${constitution}\`?\\s*\\)`);
  if (!constitutionMentionRegex.test(pt)) {
    issues.push({
      code: "DOC_002",
      severity: "high",
      file: "README.md",
      message: `README.md não menciona constitutionVersion atual (${constitution}).`,
    });
  }
  if (!constitutionMentionRegex.test(en)) {
    issues.push({
      code: "DOC_002",
      severity: "high",
      file: "README.en.md",
      message: `README.en.md não menciona constitutionVersion atual (${constitution}).`,
    });
  }

  const totalInTree = Number((srcTree.match(/\|\s\*\*Total\*\*\s\|\s\*\*([0-9]+)\s+arquivos\*\*\s\|/m) || [])[1] || "0");
  const totalReal = countFilesRecursive(ROOT);
  if (totalInTree !== totalReal) {
    issues.push({
      code: "DOC_003",
      severity: "high",
      file: "config/source-tree.md",
      message: `Contagem total divergente: source-tree=${totalInTree}, real=${totalReal}.`,
    });
  }

  const scriptsInTree = Number((srcTree.match(/\|\sScripts\s\|\s([0-9]+)\s\|/m) || [])[1] || "0");
  const scriptsReal = fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => f.endsWith(".js")).length;
  if (scriptsInTree !== scriptsReal) {
    issues.push({
      code: "DOC_004",
      severity: "high",
      file: "config/source-tree.md",
      message: `Contagem de scripts divergente: source-tree=${scriptsInTree}, real=${scriptsReal}.`,
    });
  }

  const summary = {
    critical: 0,
    high: issues.length,
    medium: 0,
    low: 0,
  };
  return {
    validator: "validate-doc-consistency",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    issues,
    summary,
    verdict: issues.length ? "CONCERNS" : "PASSED",
  };
}

const report = validate();
console.log(JSON.stringify(report, null, 2));
process.exit(report.summary.critical > 0 ? 1 : 0);
