#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const AGENTS_DIR = path.join(ROOT, "agents");
const WORKFLOWS_DIR = path.join(ROOT, "workflows");
const TASKS_DIR = path.join(ROOT, "tasks");

function listFiles(dir, ext) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => path.join(dir, entry.name));
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function collectAgentCommandMap() {
  const map = new Map();
  const files = listFiles(AGENTS_DIR, ".md");
  const cmdRegex = /- name:\s*"\*([a-z0-9-]+)"/g;
  const idRegex = /^\s*id:\s*([a-z0-9-]+)/m;

  for (const file of files) {
    const text = read(file);
    const idMatch = text.match(idRegex);
    if (!idMatch) continue;
    const id = idMatch[1];
    const commands = new Set();
    let m = cmdRegex.exec(text);
    while (m) {
      commands.add(m[1]);
      m = cmdRegex.exec(text);
    }
    cmdRegex.lastIndex = 0;
    map.set(id, commands);
  }
  return map;
}

function collectTaskContracts() {
  const tasks = new Map();
  const files = listFiles(TASKS_DIR, ".md");

  for (const file of files) {
    const text = read(file);
    const taskNameMatch = text.match(/^task:\s*([A-Za-z0-9_]+\(\))/m);
    if (!taskNameMatch) continue;
    const taskName = taskNameMatch[1];
    const lines = text.split(/\r?\n/);
    const outputs = new Map();
    const inputs = new Map();
    let inOutput = false;
    let inInput = false;
    let currentOutputName = null;
    let currentInputName = null;

    for (const line of lines) {
      if (/^Entrada:\s*$/.test(line)) {
        inInput = true;
        inOutput = false;
        currentInputName = null;
        continue;
      }
      if (/^Saida:\s*$/.test(line)) {
        inOutput = true;
        inInput = false;
        currentOutputName = null;
        continue;
      }
      if ((inOutput || inInput) && /^[A-Za-z][A-Za-z _-]*:\s*$/.test(line)) {
        inOutput = false;
        inInput = false;
        continue;
      }
      if (inOutput) {
        const n = line.match(/^\s*-\s*nome:\s*([A-Za-z0-9_-]+)/);
        if (n) {
          currentOutputName = n[1];
          outputs.set(currentOutputName, "unknown");
          continue;
        }
        const t = line.match(/^\s*tipo:\s*([A-Za-z0-9_<>\-| ]+)/);
        if (t && currentOutputName) {
          outputs.set(currentOutputName, t[1].trim());
        }
      }
      if (inInput) {
        const n = line.match(/^\s*-\s*nome:\s*([A-Za-z0-9_-]+)/);
        if (n) {
          currentInputName = n[1];
          inputs.set(currentInputName, "unknown");
          continue;
        }
        const t = line.match(/^\s*tipo:\s*([A-Za-z0-9_<>\-| ]+)/);
        if (t && currentInputName) {
          inputs.set(currentInputName, t[1].trim());
        }
      }
    }
    tasks.set(taskName, { inputs, outputs, file: path.basename(file) });
  }
  return tasks;
}

function collectTaskOutputs(taskContracts) {
  const outputNames = new Set();
  for (const task of taskContracts.values()) {
    for (const name of task.outputs.keys()) outputNames.add(name);
  }
  return outputNames;
}

function collectCommandTaskBindings() {
  const bindings = new Map();
  const files = listFiles(AGENTS_DIR, ".md");
  for (const file of files) {
    const text = read(file).split(/\r?\n/);
    const idMatch = text.join("\n").match(/^\s*id:\s*([a-z0-9-]+)/m);
    if (!idMatch) continue;
    const agentId = idMatch[1];
    let currentCommand = null;
    let inLoader = false;
    for (const line of text) {
      if (/^command_loader:\s*$/.test(line)) {
        inLoader = true;
        continue;
      }
      if (inLoader && /^[a-zA-Z_][a-zA-Z0-9_-]*:\s*$/.test(line)) {
        break;
      }
      if (!inLoader) continue;
      const cmd = line.match(/^\s*"\*([a-z0-9-]+)":\s*$/);
      if (cmd) {
        currentCommand = cmd[1];
        continue;
      }
      const req = line.match(/^\s*-\s*"tasks\/([a-z0-9-]+)\.md"\s*$/);
      if (req && currentCommand) {
        const key = `${agentId}::${currentCommand}`;
        if (!bindings.has(key)) bindings.set(key, []);
        bindings.get(key).push(req[1]);
      }
    }
  }
  return bindings;
}

function parseWorkflowTransitions(text) {
  const lines = text.split(/\r?\n/);
  const transitions = [];
  let inTransitions = false;
  let current = null;

  for (const line of lines) {
    if (/^transitions:\s*$/.test(line)) {
      inTransitions = true;
      continue;
    }
    if (!inTransitions) continue;
    if (/^[a-zA-Z_][a-zA-Z0-9_-]*:\s*$/.test(line)) break;
    const keyMatch = line.match(/^\s{2}([a-zA-Z0-9_-]+):\s*$/);
    if (keyMatch) {
      if (current) transitions.push(current);
      current = { transitionKey: keyMatch[1], commands: [], args: [] };
      continue;
    }
    if (!current) continue;
    const from = line.match(/^\s+from:\s*"([^"]+)"/);
    if (from) current.from = from[1];
    const to = line.match(/^\s+to:\s*"([^"]+)"/);
    if (to) current.to = to[1];
    const cmd = line.match(/^\s+- command:\s*"\*([a-z0-9-]+)"/);
    if (cmd) current.commands.push(cmd[1]);
    const args = line.match(/^\s+args:\s*"([^"]+)"/);
    if (args) current.args.push(args[1]);
  }
  if (current) transitions.push(current);
  return transitions;
}

function collectWorkflowAgentSequence(text) {
  const agents = new Set();
  const lines = text.split(/\r?\n/);
  let inSeq = false;
  for (const line of lines) {
    if (/^agent_sequence:\s*$/.test(line)) {
      inSeq = true;
      continue;
    }
    if (!inSeq) continue;
    if (/^[a-zA-Z_][a-zA-Z0-9_-]*:\s*$/.test(line)) break;
    const m = line.match(/^\s+-\s+([a-z0-9-]+)\s*$/);
    if (m) agents.add(m[1]);
  }
  return agents;
}

function validate() {
  const issues = [];
  const agentCommandMap = collectAgentCommandMap();
  const taskContracts = collectTaskContracts();
  const taskOutputs = collectTaskOutputs(taskContracts);
  const commandTaskBindings = collectCommandTaskBindings();
  const workflowFiles = listFiles(WORKFLOWS_DIR, ".yaml");
  const allowedPlaceholder = /^(?:[A-Za-z0-9_-]+(?:\.output)?)$/;

  for (const wf of workflowFiles) {
    const rel = path.relative(ROOT, wf);
    const text = read(wf);
    const transitions = parseWorkflowTransitions(text);
    const seqAgents = collectWorkflowAgentSequence(text);

    for (const tr of transitions) {
      if (!tr.from || !tr.to) {
        issues.push({
          code: "HND_001",
          severity: "critical",
          file: rel,
          message: `Transition ${tr.transitionKey} sem from/to completos.`,
        });
        continue;
      }

      if (tr.to !== "pipeline-end" && tr.to !== "workflow-engine" && !seqAgents.has(tr.to)) {
        issues.push({
          code: "HND_002",
          severity: "critical",
          file: rel,
          message: `Transition ${tr.transitionKey} aponta to inválido: ${tr.to}.`,
        });
      }

      if (seqAgents.has(tr.to)) {
        const targetCommands = agentCommandMap.get(tr.to) || new Set();
        for (const cmd of tr.commands) {
          if (!targetCommands.has(cmd)) {
            issues.push({
              code: "HND_003",
              severity: "critical",
              file: rel,
              message: `Comando *${cmd} não existe no agente destino ${tr.to}.`,
            });
          }
        }
      }

      const placeholderRegex = /\{([A-Za-z0-9_.-]+)\}/g;
      for (const rawArgs of tr.args) {
        const pairs = [];
        for (const token of rawArgs.split(/\s+/)) {
          const kv = token.match(/^--([A-Za-z0-9_-]+)=\{([A-Za-z0-9_.-]+)\}$/);
          if (kv) pairs.push({ input: kv[1], ref: kv[2] });
        }
        let p = placeholderRegex.exec(rawArgs);
        while (p) {
          const ref = p[1];
          if (!allowedPlaceholder.test(ref)) {
            issues.push({
              code: "HND_005",
              severity: "critical",
              file: rel,
              message: `Placeholder fora do contrato permitido: {${ref}}.`,
            });
          }
          if (!ref.endsWith(".output") && !taskOutputs.has(ref)) {
            issues.push({
              code: "HND_004",
              severity: "critical",
              file: rel,
              message: `Placeholder de args sem output conhecido: {${ref}}.`,
            });
          }
          p = placeholderRegex.exec(rawArgs);
        }
        placeholderRegex.lastIndex = 0;

        if (seqAgents.has(tr.to) && tr.commands.length) {
          for (const cmd of tr.commands) {
            const bindKey = `${tr.to}::${cmd}`;
            const taskFiles = commandTaskBindings.get(bindKey) || [];
            if (!taskFiles.length) continue;
            const primaryTask = taskFiles[0];
            const taskKeyGuess = `${primaryTask}()`;
            const taskName = Array.from(taskContracts.keys()).find(
              (name) => name.toLowerCase() === taskKeyGuess.toLowerCase(),
            );
            if (!taskName) continue;
            const task = taskContracts.get(taskName);
            for (const pair of pairs) {
              if (!task.inputs.has(pair.input)) continue;
              const expectedType = task.inputs.get(pair.input);
              if (pair.ref.endsWith(".output")) continue;
              let sourceType = "unknown";
              for (const tc of taskContracts.values()) {
                if (tc.outputs.has(pair.ref)) {
                  sourceType = tc.outputs.get(pair.ref);
                  break;
                }
              }
              if (
                sourceType !== "unknown" &&
                expectedType !== "unknown" &&
                sourceType !== expectedType
              ) {
                issues.push({
                  code: "HND_006",
                  severity: "critical",
                  file: rel,
                  message: `Incompatibilidade de tipo em args: ${pair.input} espera ${expectedType}, recebeu ${sourceType} de {${pair.ref}}.`,
                });
              }
            }
          }
        }
      }
    }
  }

  const summary = {
    critical: issues.filter((i) => i.severity === "critical").length,
    high: 0,
    medium: 0,
    low: 0,
  };

  return {
    validator: "validate-handoff",
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    issues,
    summary,
    verdict: summary.critical > 0 ? "FAILED" : "PASSED",
  };
}

const report = validate();
console.log(JSON.stringify(report, null, 2));
process.exit(report.summary.critical > 0 ? 1 : 0);
