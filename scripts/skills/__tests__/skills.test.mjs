// Trava da biblioteca de Skills do Héfisto (.claude/skills/*/SKILL.md).
//   npm run test:skills
// Confere: formato que o Claude Code descobre (frontmatter name/description),
// caminhos e comandos citados que existem de verdade, dependências entre
// Skills sem ciclo (orquestrador → domínio → base), nenhum segredo e nenhuma
// permissão pré-concedida (allowed-tools) nem afrouxamento das travas do
// .claude/settings.json.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PASTA = path.join(RAIZ, ".claude/skills");
const ORQUESTRADOR = "hefisto-orquestrador";
const BASE = ["hefisto-seguranca-supabase", "hefisto-entrega"];
const FORA_DO_ROTEAMENTO = ["hefisto-ciclo"]; // ciclo autônomo: entra pelo CLAUDE.md, não pelo orquestrador

function frontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const campos = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const i = linha.indexOf(":");
    if (i > 0 && !/^\s/.test(linha)) campos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  return { campos, corpo: texto.slice(m[0].length) };
}

const skills = fs.readdirSync(PASTA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
  const arquivo = path.join(PASTA, d.name, "SKILL.md");
  const texto = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, "utf8") : null;
  return { dir: d.name, arquivo, texto, fm: texto ? frontmatter(texto) : null };
});
const nomes = new Set(skills.map((s) => s.dir));

// tokens entre crases (inclui os de dentro de blocos de código)
function tokens(texto) {
  const out = [];
  for (const m of texto.matchAll(/`([^`\n]+)`/g)) out.push(...m[1].split(/\s+/));
  for (const m of texto.matchAll(/```[a-z]*\r?\n([\s\S]*?)```/g)) out.push(...m[1].split(/\s+/));
  return out.map((t) => t.replace(/[),;:.]+$/, "").replace(/^\(/, "")).filter(Boolean);
}

function referencias(s) {
  const ref = new Set();
  for (const m of s.texto.matchAll(/hefisto-[a-z-]+[a-z]/g)) if (nomes.has(m[0]) && m[0] !== s.dir) ref.add(m[0]);
  return ref;
}

test("existe orquestrador, as duas de base e todas as áreas pedidas", () => {
  for (const n of [ORQUESTRADOR, ...BASE, "hefisto-estoque", "hefisto-compras-cmv", "hefisto-financeiro", "hefisto-rh-ponto",
    "hefisto-pdv-kds", "hefisto-eventos", "hefisto-whatsapp-crm", "hefisto-integracoes", "hefisto-auditoria-ui", "hefisto-diagnostico"]) {
    assert.ok(nomes.has(n), `falta a Skill ${n}`);
  }
});

for (const s of skills) {
  test(`${s.dir}: formato que o Claude Code descobre`, () => {
    assert.ok(s.texto, "sem SKILL.md");
    assert.ok(s.fm, "sem frontmatter --- no topo");
    const { name, description } = s.fm.campos;
    assert.equal(name, s.dir, "name tem que ser igual ao nome da pasta");
    assert.match(name, /^[a-z0-9-]{1,64}$/);
    assert.ok(description && description.length >= 40 && description.length <= 1024, "description entre 40 e 1024 caracteres");
    assert.match(description, /\bUse\b/, "description diz quando usar");
    assert.ok(s.fm.corpo.split(/\r?\n/).length < 200, "SKILL.md curto (detalhe vai para docs/brain)");
  });

  test(`${s.dir}: não pré-concede permissão nem traz segredo`, () => {
    assert.equal(s.fm.campos["allowed-tools"], undefined, "allowed-tools liberaria ferramentas sem confirmação");
    assert.doesNotMatch(s.texto, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "parece um JWT");
    assert.doesNotMatch(s.texto, /\b(sk-[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9]+|EAA[A-Za-z0-9]{30,})/, "parece uma chave");
    assert.doesNotMatch(s.texto, /[A-Z_]*(KEY|TOKEN|SECRET)=\S{8,}/, "variável com valor");
    assert.doesNotMatch(s.texto, /--no-verify|--force\b|-X (ours|theirs)|dangerously/i, "comando que contorna proteção");
  });

  test(`${s.dir}: caminhos e comandos citados existem`, () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
    const faltando = [];
    const toks = tokens(s.texto);
    for (const t of toks) {
      if (/[<>*{}…]/.test(t)) continue; // modelo, glob ou reticências
      if (/^(app|db|docs|scripts|\.claude)\//.test(t) || /^(CLAUDE\.md|package\.json|tailwind\.config\.js)$/.test(t)) {
        if (!fs.existsSync(path.join(RAIZ, t.replace(/\/$/, "")))) faltando.push(t);
      }
    }
    for (let i = 0; i < toks.length - 2; i++) {
      if (toks[i] === "npm" && toks[i + 1] === "run" && !/[<>]/.test(toks[i + 2]) && !pkg.scripts[toks[i + 2]]) faltando.push(`npm run ${toks[i + 2]}`);
    }
    assert.deepEqual(faltando, [], "citado na Skill mas não existe no repositório");
  });
}

test("dependências: orquestrador → domínio → base, sem ciclo", () => {
  const grafo = new Map(skills.map((s) => [s.dir, referencias(s)]));
  for (const b of BASE) assert.deepEqual([...grafo.get(b)], [], `${b} é base e não pode depender de outra Skill`);
  for (const [n, refs] of grafo) assert.ok(!refs.has(ORQUESTRADOR), `${n} aponta para o orquestrador (ciclo)`);
  const estado = new Map();
  const visitar = (n, pilha) => {
    if (estado.get(n) === "feito") return;
    assert.notEqual(estado.get(n), "visitando", `ciclo: ${[...pilha, n].join(" → ")}`);
    estado.set(n, "visitando");
    for (const r of grafo.get(n)) visitar(r, [...pilha, n]);
    estado.set(n, "feito");
  };
  for (const n of grafo.keys()) visitar(n, []);
});

test("o orquestrador alcança todas as Skills de domínio", () => {
  const orq = referencias(skills.find((s) => s.dir === ORQUESTRADOR));
  for (const n of nomes) {
    if (n === ORQUESTRADOR || FORA_DO_ROTEAMENTO.includes(n)) continue;
    assert.ok(orq.has(n), `${n} não está no roteamento do orquestrador`);
  }
});

test("toda Skill de domínio diz o que precisa do dono", () => {
  for (const s of skills) {
    if ([ORQUESTRADOR, ...BASE, ...FORA_DO_ROTEAMENTO, "hefisto-auditoria-ui", "hefisto-diagnostico"].includes(s.dir)) continue;
    assert.match(s.texto, /^## Precisa do dono/m, `${s.dir} sem a seção "Precisa do dono"`);
  }
});

test("as travas de produção do .claude/settings.json continuam lá", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, ".claude/settings.json"), "utf8"));
  const deny = cfg.permissions?.deny || [];
  for (const regra of ["Bash(gh pr merge:*)", "Bash(git push origin main:*)", "Bash(git push --force:*)", "Bash(supabase db push:*)", "Bash(supabase db reset:*)", "Bash(vercel --prod:*)", "Bash(git reset --hard:*)"]) {
    assert.ok(deny.includes(regra), `falta a trava ${regra}`);
  }
  const allow = cfg.permissions?.allow || [];
  assert.ok(!allow.some((a) => /supabase|vercel|gh pr merge|git push/i.test(a)), "allow não pode liberar banco, deploy, merge ou push");
});
