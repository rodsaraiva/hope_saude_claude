#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LOCK_PATH = path.join(ROOT, ".squad-lock.json");
const HISTORY_DIR = path.join(ROOT, "reports", "validation-history");

function runNodeScript(script, args = []) {
  const full = path.join(ROOT, "scripts", script);
  const result = cp.spawnSync("node", [full, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const stdout = (result.stdout || "").trim();
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (_e) {
    parsed = {
      validator: script.replace(".js", ""),
      version: "unknown",
      generatedAt: new Date().toISOString(),
      issues: [
        {
          code: "VAL_000",
          severity: "critical",
          file: `scripts/${script}`,
          message: `Saída inválida (não JSON): ${stdout.slice(0, 400)}`,
        },
      ],
      summary: { critical: 1, high: 0, medium: 0, low: 0 },
      verdict: "FAILED",
    };
  }
  return { exitCode: result.status, report: parsed };
}

function sum(a, b) {
  return {
    critical: (a.critical || 0) + (b.critical || 0),
    high: (a.high || 0) + (b.high || 0),
    medium: (a.medium || 0) + (b.medium || 0),
    low: (a.low || 0) + (b.low || 0),
  };
}

function deriveStatus(summary) {
  if (summary.critical > 0) return "draft";
  if (summary.high > 0) return "candidate";
  return "installed";
}

function reasonForStatus(status) {
  if (status === "draft") return "Falha em gates críticos de validação.";
  if (status === "candidate") return "Sem críticos, mas com findings de severidade alta.";
  return "Todos os gates passaram sem findings de alta severidade.";
}

function main() {
  const structure = runNodeScript("validate-structure.js");
  const xref = runNodeScript("validate-cross-references.js", ["--json"]);
  const handoff = runNodeScript("validate-handoff.js");
  const shell = runNodeScript("validate-shell-compat.js");
  const docs = runNodeScript("validate-doc-consistency.js");

  const reports = [structure.report, xref.report, handoff.report, shell.report, docs.report];
  const summary = reports.reduce((acc, r) => sum(acc, r.summary || {}), {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const status = deriveStatus(summary);

  const lock = {
    status,
    reason: reasonForStatus(status),
    lastValidatedAt: new Date().toISOString(),
    gates: {
      structure: structure.report.verdict === "PASSED" ? "passed" : "failed",
      crossReferences: xref.report.verdict === "PASSED" ? "passed" : "failed",
      handoffIntegrity: handoff.report.verdict === "PASSED" ? "passed" : "failed",
      shellCompatibility:
        shell.report.verdict === "PASSED"
          ? "passed"
          : shell.report.verdict === "CONCERNS"
            ? "candidate"
            : "failed",
      docsConsistency:
        docs.report.verdict === "PASSED"
          ? "passed"
          : docs.report.verdict === "CONCERNS"
            ? "candidate"
            : "failed",
    },
    summary,
    validators: reports,
  };

  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n", "utf8");
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(
    path.join(HISTORY_DIR, `${ts}.json`),
    JSON.stringify(lock, null, 2) + "\n",
    "utf8",
  );
  console.log(JSON.stringify(lock, null, 2));

  process.exit(status === "draft" ? 1 : 0);
}

main();
