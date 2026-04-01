#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SQUAD_YAML = path.join(ROOT, "squad.yaml");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listFilesRecursive(dir) {
  const output = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFilesRecursive(full));
    } else {
      output.push(full);
    }
  }
  return output;
}

function getShellProfile() {
  const text = read(SQUAD_YAML);
  const m = text.match(/shellProfileDefault:\s*"([^"]+)"/);
  return m ? m[1] : "powershell";
}

function validate() {
  const profile = getShellProfile();
  const issues = [];
  const files = listFilesRecursive(ROOT).filter((p) => /\.(md|yaml|yml)$/.test(p));
  const rel = (p) => path.relative(ROOT, p);

  const bannedByProfile = {
    powershell: [
      { regex: /\bmkdir\s+-p\b/, command: "mkdir -p" },
      { regex: /\bls\s+-la\b/, command: "ls -la" },
      { regex: /\btouch\s+[^\n]+/, command: "touch" },
    ],
  };

  const banned = bannedByProfile[profile] || [];
  const allowContextRegex = /evitar|n[aã]o-port[áa]vel|non-portable|avoid/i;
  for (const file of files) {
    const lines = read(file).split(/\r?\n/);
    for (const line of lines) {
      if (allowContextRegex.test(line)) continue;
      for (const rule of banned) {
        if (rule.regex.test(line)) {
          issues.push({
            code: "SHL_001",
            severity: "high",
            file: rel(file),
            message: `Comando não-portável para ${profile}: ${rule.command}`,
          });
        }
      }
    }
  }

  const summary = {
    critical: 0,
    high: issues.length,
    medium: 0,
    low: 0,
  };

  return {
    validator: "validate-shell-compat",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    profile,
    issues,
    summary,
    verdict: issues.length ? "CONCERNS" : "PASSED",
  };
}

const report = validate();
console.log(JSON.stringify(report, null, 2));
process.exit(report.summary.critical > 0 ? 1 : 0);
