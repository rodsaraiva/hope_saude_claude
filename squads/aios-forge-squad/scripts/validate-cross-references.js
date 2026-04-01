#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AGENTS_DIR = path.join(ROOT, "agents");
const TASKS_DIR = path.join(ROOT, "tasks");
const WORKFLOWS_DIR = path.join(ROOT, "workflows");
const SQUAD_MANIFEST = path.join(ROOT, "squad.yaml");
const JSON_MODE = process.argv.includes("--json");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listFiles(dir, ext) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => path.join(dir, entry.name));
}

function collectAgentCommands() {
  const commands = new Set();
  const files = listFiles(AGENTS_DIR, ".md");
  const regex = /- name:\s*"\*([a-z0-9-]+)"/g;

  for (const file of files) {
    const text = read(file);
    let match = regex.exec(text);
    while (match) {
      commands.add(match[1]);
      match = regex.exec(text);
    }
    regex.lastIndex = 0;
  }
  return commands;
}

function collectWorkflowCommands() {
  const references = [];
  const files = listFiles(WORKFLOWS_DIR, ".yaml");

  const keyRegex = /-\s*"\*([a-z0-9-]+)"/g;
  const stepRegex = /command:\s*"\*([a-z0-9-]+)"/g;

  for (const file of files) {
    const text = read(file);
    for (const regex of [keyRegex, stepRegex]) {
      let match = regex.exec(text);
      while (match) {
        const command = match[1];
        if (!command.includes("{")) {
          references.push({ file: path.basename(file), command });
        }
        match = regex.exec(text);
      }
      regex.lastIndex = 0;
    }
  }
  return references;
}

function collectTaskOutputs() {
  const outputNames = new Set();
  const files = listFiles(TASKS_DIR, ".md");

  for (const file of files) {
    const lines = read(file).split(/\r?\n/);
    let inOutput = false;
    for (const line of lines) {
      if (/^Saida:\s*$/.test(line)) {
        inOutput = true;
        continue;
      }
      if (inOutput && /^[A-Za-z][A-Za-z _-]*:\s*$/.test(line)) {
        break;
      }
      if (inOutput) {
        const match = line.match(/^\s*-\s*nome:\s*([A-Za-z0-9_-]+)/);
        if (match) outputNames.add(match[1]);
      }
    }
  }
  return outputNames;
}

function collectManualCommands() {
  const refs = [];
  const files = listFiles(WORKFLOWS_DIR, ".yaml");
  const regex = /manual_command:\s*"\*([a-z0-9-]+)"/g;

  for (const file of files) {
    const text = read(file);
    let match = regex.exec(text);
    while (match) {
      refs.push({ file: path.basename(file), command: match[1] });
      match = regex.exec(text);
    }
    regex.lastIndex = 0;
  }
  return refs;
}

function collectNextStepArgRefs() {
  const refs = [];
  const files = listFiles(WORKFLOWS_DIR, ".yaml");
  const argsRegex = /args:\s*"([^"]+)"/g;
  const placeholderRegex = /\{([A-Za-z0-9_.-]+)\}/g;

  for (const file of files) {
    const text = read(file);
    let argsMatch = argsRegex.exec(text);
    while (argsMatch) {
      const rawArgs = argsMatch[1];
      let placeholder = placeholderRegex.exec(rawArgs);
      while (placeholder) {
        refs.push({
          file: path.basename(file),
          reference: placeholder[1],
          args: rawArgs,
        });
        placeholder = placeholderRegex.exec(rawArgs);
      }
      placeholderRegex.lastIndex = 0;
      argsMatch = argsRegex.exec(text);
    }
    argsRegex.lastIndex = 0;
  }
  return refs;
}

function verifyManifestPaths() {
  const text = read(SQUAD_MANIFEST);
  const lines = text.split(/\r?\n/);
  const issues = [];

  const pathPattern = /^\s*-\s+([a-z0-9-]+\.(md|yaml|json|js))\s*$/i;
  let section = null;

  for (const line of lines) {
    if (/^\s*agents:\s*$/.test(line)) section = "agents";
    else if (/^\s*tasks:\s*$/.test(line)) section = "tasks";
    else if (/^\s*workflows:\s*$/.test(line)) section = "workflows";
    else if (/^\s*scripts:\s*$/.test(line)) section = "scripts";

    const match = line.match(pathPattern);
    if (!match || !section) continue;

    const rel = match[1];
    const filePath = path.join(ROOT, section, rel);
    if (!fs.existsSync(filePath)) {
      issues.push(`Manifest referencia arquivo inexistente: ${section}/${rel}`);
    }
  }
  return issues;
}

function isResolvableArgReference(reference, taskOutputs) {
  if (reference.endsWith(".output")) return true;
  if (taskOutputs.has(reference)) return true;
  return false;
}

function main() {
  const agentCommands = collectAgentCommands();
  const workflowRefs = collectWorkflowCommands();
  const manualRefs = collectManualCommands();
  const taskOutputs = collectTaskOutputs();
  const argRefs = collectNextStepArgRefs();
  const missing = workflowRefs.filter((ref) => !agentCommands.has(ref.command));
  const missingManual = manualRefs.filter((ref) => !agentCommands.has(ref.command));
  const unresolvedArgs = argRefs.filter(
    (ref) => !isResolvableArgReference(ref.reference, taskOutputs),
  );
  const manifestIssues = verifyManifestPaths();
  const issues = [];

  if (missing.length) {
    issues.push(
      ...missing.map((i) => ({
        code: "XRF_001",
        severity: "critical",
        file: i.file,
        message: `Workflow command missing: *${i.command}`,
      })),
    );
  }
  if (missingManual.length) {
    issues.push(
      ...missingManual.map((i) => ({
        code: "XRF_002",
        severity: "critical",
        file: i.file,
        message: `manual_command inexistente: *${i.command}`,
      })),
    );
  }
  if (unresolvedArgs.length) {
    issues.push(
      ...unresolvedArgs.map(
        (i) => ({
          code: "XRF_003",
          severity: "critical",
          file: i.file,
          message: `next_steps.args sem output correspondente: {${i.reference}} em "${i.args}"`,
        }),
      ),
    );
  }
  if (manifestIssues.length) {
    issues.push(
      ...manifestIssues.map((msg) => ({
        code: "XRF_004",
        severity: "critical",
        file: "squad.yaml",
        message: msg,
      })),
    );
  }

  const summary = {
    critical: issues.filter((i) => i.severity === "critical").length,
    high: 0,
    medium: 0,
    low: 0,
  };
  const report = {
    validator: "validate-cross-references",
    version: "1.1.0",
    generatedAt: new Date().toISOString(),
    issues,
    summary,
    verdict: summary.critical > 0 ? "FAILED" : "PASSED",
  };

  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!issues.length) {
    console.log("OK: referências cruzadas validadas com sucesso.");
  } else {
    console.error("Falhas de referências cruzadas encontradas:");
    for (const item of issues) {
      console.error(`- [${item.code}] ${item.file}: ${item.message}`);
    }
  }

  if (!issues.length) {
    process.exit(0);
  }
  process.exit(1);
}

main();
