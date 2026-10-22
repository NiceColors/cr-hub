#!/usr/bin/env node
// Prepara o CR Tracker num clone novo: dependências, .env.local, banco e
// migrations. Usa só módulos do Node, porque roda antes do `npm install`.
//
//   npm run setup              interativo: oferece configurar o token no fim
//   npm run setup -- --yes     sem perguntas (CI ou reinstalação)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const DEFAULT_DATABASE_URL = "file:./.data/cr-tracker.db";
const MIN_NODE = [20, 9];
const APP_URL = "http://localhost:43123";

const args = new Set(process.argv.slice(2));
const interactive = process.stdin.isTTY && !args.has("--yes") && !args.has("-y");

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = color("1");
const dim = color("2");
const green = color("32");
const yellow = color("33");
const red = color("31");

let stepNumber = 0;
function step(title) {
  stepNumber++;
  console.log(`\n${bold(`[${stepNumber}] ${title}`)}`);
}

function fail(message, hint) {
  console.error(`\n${red("✖")} ${message}`);
  if (hint) console.error(dim(hint));
  process.exit(1);
}

/** Roda um comando npm fixo (sem entrada do usuário) e diz se terminou bem. */
function runNpm(npmArgs) {
  const command = `npm ${npmArgs.join(" ")}`;
  console.log(dim(`$ ${command}`));
  // npm é um .cmd no Windows e só roda através do shell.
  const result = spawnSync(command, { cwd: ROOT, stdio: "inherit", shell: true, env: process.env });
  return result.status === 0;
}

// --- .env.local ---------------------------------------------------------------

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

function readEnvFile() {
  return fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, "utf8")) : {};
}

const PLACEHOLDERS = new Set(["seu-workspace", "voce@empresa.com", "xxxxxxxxxxxxxxxx"]);

function hasEnvCredentials(env) {
  return ["BITBUCKET_WORKSPACE", "BITBUCKET_EMAIL", "BITBUCKET_API_TOKEN"].every(
    (key) => env[key] && !PLACEHOLDERS.has(env[key]),
  );
}

function envTemplate() {
  return `## Banco local (SQLite)
DATABASE_URL="${DEFAULT_DATABASE_URL}"

## Bitbucket Cloud
# Opcional: o jeito recomendado é configurar em ${APP_URL}/config → Integrações.
# Se preferir variáveis de ambiente, descomente e preencha as três linhas.
# BITBUCKET_WORKSPACE="seu-workspace"
# BITBUCKET_EMAIL="voce@empresa.com"
# BITBUCKET_API_TOKEN="seu-api-token"
`;
}

/** Troca (ou descomenta) uma variável no .env.local, preservando o resto do arquivo. */
function setEnvValue(text, key, value) {
  const line = `${key}="${value.replace(/"/g, '\\"')}"`;
  const pattern = new RegExp(`^\\s*#?\\s*${key}\\s*=.*$`, "m");
  return pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
}

// --- Perguntas ----------------------------------------------------------------

function createPrompter() {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });

  const ask = (question, { secret = false } = {}) =>
    new Promise((resolve) => {
      process.stdout.write(question);
      muted = secret;
      rl.question("", (answer) => {
        if (secret) process.stdout.write("\n");
        muted = false;
        resolve(answer.trim());
      });
    });

  return { ask, close: () => rl.close() };
}

async function checkBitbucketCredentials({ workspace, email, apiToken }) {
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  const url = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace)}?pagelen=1&fields=values.uuid`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: "e-mail ou token inválido (401)." };
    if (res.status === 403) return { ok: false, message: "o token não tem permissão de leitura no workspace (403)." };
    if (res.status === 404) return { ok: false, message: `workspace "${workspace}" não encontrado (404).` };
    return { ok: false, message: `o Bitbucket respondeu ${res.status}.` };
  } catch (err) {
    return { ok: false, message: `sem resposta do Bitbucket (${err instanceof Error ? err.message : err}).` };
  }
}

async function askForCredentials() {
  const prompter = createPrompter();
  try {
    const answer = await prompter.ask(
      `Configurar o token do Bitbucket agora? ${dim("(s/N, dá para fazer depois pela interface)")} `,
    );
    if (!/^s(im)?$/i.test(answer)) return false;

    console.log(
      dim(
        "Crie o token em Bitbucket → Personal settings → App passwords, com leitura em\n" +
          "Account, Workspace membership, Repositories e Pull requests (e escrita em\n" +
          "Pull requests se quiser usar \"Me adicionar como revisor\").",
      ),
    );
    for (let attempt = 1; attempt <= 3; attempt++) {
      const workspace = await prompter.ask("  Workspace (slug): ");
      const email = await prompter.ask("  E-mail da conta: ");
      const apiToken = await prompter.ask("  API token (não aparece ao digitar): ", { secret: true });
      if (!workspace || !email || !apiToken) {
        console.log(yellow("  Preencha os três campos."));
        continue;
      }

      process.stdout.write(dim("  Validando no Bitbucket… "));
      const check = await checkBitbucketCredentials({ workspace, email, apiToken });
      if (!check.ok) {
        console.log(red("falhou:"), check.message);
        continue;
      }
      console.log(green("ok"));

      let text = fs.readFileSync(ENV_FILE, "utf8");
      text = setEnvValue(text, "BITBUCKET_WORKSPACE", workspace);
      text = setEnvValue(text, "BITBUCKET_EMAIL", email);
      text = setEnvValue(text, "BITBUCKET_API_TOKEN", apiToken);
      fs.writeFileSync(ENV_FILE, text);
      console.log(green("  Credenciais salvas em .env.local."));
      return true;
    }
    console.log(yellow("  Não foi possível validar. Configure depois pela interface."));
    return false;
  } finally {
    prompter.close();
  }
}

// --- Passos -------------------------------------------------------------------

async function main() {
  console.log(bold("CR Tracker · configuração inicial"));

  step("Verificando o Node.js");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
    fail(
      `Node.js ${process.versions.node} é antigo demais; o app precisa de ${MIN_NODE.join(".")} ou mais novo.`,
      "Instale a versão LTS em https://nodejs.org e rode `npm run setup` de novo.",
    );
  }
  console.log(green(`Node.js ${process.versions.node}`));

  step("Instalando dependências");
  const hasLockfile = fs.existsSync(path.join(ROOT, "package-lock.json"));
  const hasModules = fs.existsSync(path.join(ROOT, "node_modules"));
  const installArgs = hasLockfile && !hasModules ? ["ci"] : ["install"];
  if (!runNpm(installArgs)) {
    fail(
      "A instalação das dependências falhou.",
      "O better-sqlite3 é nativo: no Windows, se não houver binário pronto para a sua versão do\n" +
        "Node, instale as \"Desktop development with C++\" do Visual Studio Build Tools, ou use o Node LTS.",
    );
  }

  step("Preparando o .env.local");
  if (fs.existsSync(ENV_FILE)) {
    console.log("Já existe; mantido como está.");
  } else {
    fs.writeFileSync(ENV_FILE, envTemplate());
    console.log(green("Criado com o banco local em .data/cr-tracker.db."));
  }

  step("Criando o banco e aplicando migrations");
  if (!runNpm(["run", "db:migrate"])) {
    fail("As migrations falharam.", "Confira o DATABASE_URL no .env.local e rode `npm run db:migrate`.");
  }

  step("Credenciais do Bitbucket");
  let configured = hasEnvCredentials(readEnvFile());
  if (configured) {
    console.log("Já definidas no .env.local.");
  } else if (interactive) {
    configured = await askForCredentials();
  } else {
    console.log("Pulado (modo não interativo).");
  }

  console.log(`\n${green("✔")} ${bold("Pronto.")} Próximos passos:\n`);
  let n = 1;
  console.log(`  ${n++}. ${bold("npm run dev")} e abra ${APP_URL}`);
  if (!configured) {
    console.log(
      `  ${n++}. Em ${bold("Configuração → Integrações")}, informe workspace, e-mail e API token do Bitbucket`,
    );
  }
  console.log(
    `  ${n++}. Em ${bold("Configuração")}, sincronize repositórios e membros e marque o que monitorar`,
  );
  console.log("");
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
