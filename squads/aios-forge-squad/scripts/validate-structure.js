#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AGENTS_DIR = path.join(ROOT, "agents");
const TASKS_DIR = path.join(ROOT, "tasks");
const WORKFLOWS_DIR = path.join(ROOT, "workflows");
const MANIFEST_PATH = path.join(ROOT, "squad.yaml");

function listFiles(dir, ext) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => path.join(dir, entry.name));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseFrontmatter(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (lines.length > 0) {
    lines[0] = lines[0].replace(/^\uFEFF/, "");
  }
  if (lines[0] !== "---") {
    return { ok: false, reason: "missing_frontmatter" };
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    return { ok: false, reason: "unclosed_frontmatter" };
  }
  const fmLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join("\n");
  return { ok: true, lines: fmLines, body };
}

function hasTopLevelKey(lines, key) {
  const pattern = new RegExp(`^${key}:\\s*`);
  return lines.some((line) => pattern.test(line));
}

function hasSection(body, sectionTitle) {
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, "m");
  return regex.test(body);
}

function hasCommandLoader(lines) {
  return lines.some((line) => /^command_loader:\s*$/.test(line));
}

function hasCriticalLoaderRule(body) {
  return body.includes("CRITICAL_LOADER_RULE");
}

function checkAgent(filePath, report) {
  const text = readText(filePath);
  const parsed = parseFrontmatter(text);
  const rel = path.relative(ROOT, filePath);

  if (!parsed.ok) {
    report.issues.push({
      code: "STR_AGT_001",
      severity: "critical",
      file: rel,
      message: "Agente sem frontmatter YAML válido.",
      suggestion: "Adicionar bloco frontmatter delimitado por --- no início do arquivo.",
    });
    return;
  }

  const requiredTopLevel = ["agent", "persona_profile", "greeting_levels", "persona", "commands", "dependencies"];
  for (const key of requiredTopLevel) {
    if (!hasTopLevelKey(parsed.lines, key)) {
      report.issues.push({
        code: "STR_AGT_002",
        severity: "critical",
        file: rel,
        message: `Frontmatter do agente sem chave obrigatória: ${key}.`,
        suggestion: `Adicionar ${key} no frontmatter do agente.`,
      });
    }
  }

  if (!hasCommandLoader(parsed.lines)) {
    report.issues.push({
      code: "STR_AGT_003",
      severity: "critical",
      file: rel,
      message: "Agente sem command_loader.",
      suggestion: "Adicionar command_loader mapeando comandos operacionais para tasks.",
    });
  }

  if (!hasCriticalLoaderRule(parsed.body)) {
    report.issues.push({
      code: "STR_AGT_004",
      severity: "critical",
      file: rel,
      message: "Agente sem seção CRITICAL_LOADER_RULE.",
      suggestion: "Adicionar bloco CRITICAL_LOADER_RULE no corpo do agente.",
    });
  }

  const requiredSections = ["Quick Commands", "Agent Collaboration", "Usage Guide"];
  for (const section of requiredSections) {
    if (!hasSection(parsed.body, section)) {
      report.issues.push({
        code: "STR_AGT_005",
        severity: "high",
        file: rel,
        message: `Agente sem seção obrigatória: ${section}.`,
        suggestion: `Adicionar seção markdown ## ${section}.`,
      });
    }
  }
}

function checkTask(filePath, report) {
  const text = readText(filePath);
  const parsed = parseFrontmatter(text);
  const rel = path.relative(ROOT, filePath);

  if (!parsed.ok) {
    report.issues.push({
      code: "STR_TSK_001",
      severity: "critical",
      file: rel,
      message: "Task sem frontmatter YAML válido.",
      suggestion: "Adicionar bloco frontmatter delimitado por --- no início do arquivo.",
    });
    return;
  }

  const requiredTopLevel = ["task", "responsavel", "Entrada", "Saida", "Checklist"];
  for (const key of requiredTopLevel) {
    if (!hasTopLevelKey(parsed.lines, key)) {
      report.issues.push({
        code: "STR_TSK_002",
        severity: "critical",
        file: rel,
        message: `Task sem chave obrigatória no frontmatter: ${key}.`,
        suggestion: `Adicionar ${key} no frontmatter da task.`,
      });
    }
  }

  const hasOutputExpectedFormat = parsed.lines.some((line) => /^\s*formato_esperado:\s*/.test(line));
  if (!hasOutputExpectedFormat) {
    report.issues.push({
      code: "STR_TSK_003",
      severity: "critical",
      file: rel,
      message: "Task sem formato_esperado em Saida.",
      suggestion: "Adicionar formato_esperado em cada item de Saida.",
    });
  }

  if (!hasSection(parsed.body, "Pipeline Diagram")) {
    report.issues.push({
      code: "STR_TSK_004",
      severity: "high",
      file: rel,
      message: "Task sem seção Pipeline Diagram.",
      suggestion: "Adicionar seção ## Pipeline Diagram no corpo da task.",
    });
  }
}

function parseYamlTopLevelKeys(yamlText) {
  const keys = new Set();
  const lines = yamlText.split(/\r?\n/);
  for (const line of lines) {
    if (/^[a-zA-Z_][a-zA-Z0-9_-]*:\s*/.test(line)) {
      const key = line.split(":")[0].trim();
      keys.add(key);
    }
  }
  return keys;
}

function checkWorkflow(filePath, report) {
  const text = readText(filePath);
  const rel = path.relative(ROOT, filePath);
  const keys = parseYamlTopLevelKeys(text);
  const requiredTopLevel = ["workflow_name", "description", "agent_sequence", "key_commands", "transitions"];

  for (const key of requiredTopLevel) {
    if (!keys.has(key)) {
      report.issues.push({
        code: "STR_WRK_001",
        severity: "critical",
        file: rel,
        message: `Workflow sem chave obrigatória: ${key}.`,
        suggestion: `Adicionar ${key} ao YAML do workflow.`,
      });
    }
  }

  const hasTransitionShape =
    /from:\s*".+?"/.test(text) &&
    /to:\s*".+?"/.test(text) &&
    /trigger:\s*".+?"/.test(text) &&
    /confidence:\s*[0-9.]+/.test(text) &&
    /greeting_message:\s*/.test(text) &&
    /next_steps:\s*/.test(text);

  if (!hasTransitionShape) {
    report.issues.push({
      code: "STR_WRK_002",
      severity: "critical",
      file: rel,
      message: "Workflow com transições incompletas (from/to/trigger/confidence/greeting_message/next_steps).",
      suggestion: "Completar todas as transições conforme contrato obrigatório.",
    });
  }

  const keyAsObject = /key_commands:\s*\n\s*command:\s*"\*/.test(text);
  if (!keyAsObject) {
    report.issues.push({
      code: "STR_WRK_003",
      severity: "critical",
      file: rel,
      message: "Workflow com key_commands fora do formato de objeto.",
      suggestion: "Usar key_commands com command, agent e description.",
    });
  }
}

function checkManifest(report) {
  const text = readText(MANIFEST_PATH);
  const rel = path.relative(ROOT, MANIFEST_PATH);
  const keys = parseYamlTopLevelKeys(text);
  const requiredTopLevel = ["name", "version", "components", "config", "generation"];

  for (const key of requiredTopLevel) {
    if (!keys.has(key)) {
      report.issues.push({
        code: "STR_MAN_001",
        severity: "critical",
        file: rel,
        message: `Manifest sem chave obrigatória: ${key}.`,
        suggestion: `Adicionar ${key} no squad.yaml.`,
      });
    }
  }

  if (!/constitutionVersion:\s*"v[0-9]+"/.test(text)) {
    report.issues.push({
      code: "STR_MAN_002",
      severity: "high",
      file: rel,
      message: "Manifest sem generation.constitutionVersion versionado.",
      suggestion: "Definir generation.constitutionVersion no formato vN.",
    });
  }
}

function summarize(issues) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;
  }
  return counts;
}

function main() {
  const report = {
    validator: "validate-structure",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    issues: [],
  };

  for (const file of listFiles(AGENTS_DIR, ".md")) checkAgent(file, report);
  for (const file of listFiles(TASKS_DIR, ".md")) checkTask(file, report);
  for (const file of listFiles(WORKFLOWS_DIR, ".yaml")) checkWorkflow(file, report);
  checkManifest(report);

  report.summary = summarize(report.issues);
  report.verdict = report.summary.critical > 0 ? "FAILED" : report.summary.high > 0 ? "CONCERNS" : "PASSED";

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.summary.critical > 0 ? 1 : 0);
}

main();
