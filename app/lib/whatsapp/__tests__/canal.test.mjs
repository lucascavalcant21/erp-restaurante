// HDEV-WA-001: canal do WhatsApp sem rede e sem banco (TESTADO LOCAL).
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mesmoNumero, numeroAutorizado, numerosAutorizados, mascarar } from "../numero.mjs";
import { interpretar, normalizar, AJUDA } from "../comandos.mjs";
import { assinaturaValida, desafioDoWebhook, extrairMensagens, partir, enviarTexto } from "../meta.mjs";
import { atenderMensagem, limparDedupe, bloquearAcoes, ACAO_BLOQUEADA } from "../gateway.mjs";
import { formatarBrief, formatarResposta } from "../formatar.mjs";
import { criarFila } from "../fila.mjs";

const DONO = "5511987650000";
const env = { WHATSAPP_NUMEROS_DONO: DONO };

// ─── número ──────────────────────────────────────────────────────────────────
test("número: o 9º dígito do celular BR é o mesmo número; nada além disso", () => {
  assert.ok(mesmoNumero("5511987650000", "551187650000"));
  assert.ok(mesmoNumero("+55 (11) 98765-0000", "5511987650000"));
  assert.ok(!mesmoNumero("5511987650000", "5511987650001"));
  assert.ok(!mesmoNumero("5511987650000", "5521987650000"));
  assert.ok(!mesmoNumero("", ""));
  assert.ok(!mesmoNumero("123", "123"));
  assert.deepEqual(numerosAutorizados({}), []);
  assert.ok(!numeroAutorizado(DONO, {}), "sem configuração, ninguém é autorizado");
  assert.ok(numeroAutorizado("551187650000", env));
  assert.equal(mascarar(DONO), "…0000");
});

// ─── comandos ────────────────────────────────────────────────────────────────
test("comandos: a lista pedida pelo dono, com e sem acento e pontuação", () => {
  const casos = {
    "status": "status", "Como está o desenvolvimento?": "desenvolvimento", "continue": "continuar", "Pare": "parar",
    "missões": "missoes", "bloqueadores": "bloqueadores", "Aprovações": "aprovacoes", "como está minha empresa?": "empresa",
    "ajuda": "ajuda",
  };
  for (const [t, c] of Object.entries(casos)) assert.equal(interpretar(t).comando, c, t);
  assert.equal(interpretar("como está minha empresa?").destino, "hefisto");
  assert.equal(interpretar("status").destino, "agente");
  assert.equal(normalizar("  Missões?! "), "missoes");
});

test("comandos: aprovar/rejeitar com id normalizado; pergunta preserva o texto", () => {
  assert.deepEqual(interpretar("aprovar APR-3"), { comando: "aprovar", destino: "agente", args: { id: "APR-003", nota: "" } });
  assert.deepEqual(interpretar("Rejeitar apr 12 risco alto"), { comando: "rejeitar", destino: "agente", args: { id: "APR-012", nota: "risco alto" } });
  const p = interpretar("Pergunte ao Héfisto: Quanto vendi ontem?");
  assert.deepEqual(p, { comando: "perguntar", destino: "hefisto", args: { pergunta: "Quanto vendi ontem?" } });
  assert.equal(interpretar("pergunta pro hefisto quanto tenho de picanha").args.pergunta, "quanto tenho de picanha");
  const d = interpretar("apague todos os dados");
  assert.equal(d.comando, "ajuda");
  assert.ok(d.args.desconhecido, "comando fora da lista não executa nada");
});

// ─── Meta ────────────────────────────────────────────────────────────────────
test("assinatura: obrigatória, HMAC do corpo bruto; sem segredo, nada passa", () => {
  const corpo = '{"a":1}';
  const ok = `sha256=${createHmac("sha256", "segredo").update(corpo).digest("hex")}`;
  assert.ok(assinaturaValida(corpo, ok, "segredo"));
  assert.ok(!assinaturaValida(corpo, ok, ""), "sem segredo configurado");
  assert.ok(!assinaturaValida(corpo, null, "segredo"), "sem cabeçalho");
  assert.ok(!assinaturaValida(`${corpo} `, ok, "segredo"), "corpo alterado");
  assert.ok(!assinaturaValida(corpo, "sha256=abc", "segredo"), "tamanho errado não lança");
  assert.ok(!assinaturaValida(corpo, ok, "outro"));
});

test("desafio do webhook: só com o verify token configurado e igual", () => {
  const q = (o) => new URLSearchParams(o);
  assert.equal(desafioDoWebhook(q({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "123" }), "tok"), "123");
  assert.equal(desafioDoWebhook(q({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "123" }), ""), null);
  assert.equal(desafioDoWebhook(q({ "hub.mode": "subscribe", "hub.verify_token": "hefisto_verify_token", "hub.challenge": "1" }), "tok"), null);
  assert.equal(desafioDoWebhook(q({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "<script>" }), "tok"), null);
});

test("extrairMensagens: texto e botão; ignora status de entrega", () => {
  const payload = { entry: [{ changes: [
    { field: "messages", value: { metadata: { phone_number_id: "99" }, messages: [{ id: "wamid.1", from: DONO, type: "text", timestamp: "1700000000", text: { body: "status" } }] } },
    { field: "messages", value: { statuses: [{ id: "wamid.0", status: "read" }] } },
    { field: "messages", value: { messages: [{ id: "wamid.2", from: DONO, type: "image" }] } },
  ] }] };
  const m = extrairMensagens(payload);
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], { id: "wamid.1", de: DONO, tipo: "text", texto: "status", ts: 1700000000, phoneNumberId: "99" });
  assert.equal(m[1].texto, null);
  assert.deepEqual(extrairMensagens(null), []);
});

test("partir e enviarTexto: partes de até 4000; token nunca na resposta de erro", async () => {
  const longo = Array.from({ length: 300 }, (_, i) => `linha ${i} ${"x".repeat(30)}`).join("\n");
  const partes = partir(longo);
  assert.ok(partes.length > 1 && partes.every((p) => p.length <= 4000));
  const chamadas = [];
  const fetchOk = async (url, o) => { chamadas.push({ url, o }); return { ok: true, json: async () => ({}) }; };
  const e = { WHATSAPP_API_TOKEN: "TOKEN-SECRETO", WHATSAPP_PHONE_NUMBER_ID: "123" };
  assert.deepEqual(await enviarTexto({ para: DONO, texto: "oi", env: e, fetchImpl: fetchOk }), { ok: true });
  assert.equal(chamadas[0].url, "https://graph.facebook.com/v23.0/123/messages");
  assert.equal(JSON.parse(chamadas[0].o.body).to, DONO);
  const fetchErro = async () => ({ ok: false, status: 401, json: async () => ({ error: { code: 190, message: "Invalid OAuth access token" } }) });
  const r = await enviarTexto({ para: DONO, texto: "oi", env: e, fetchImpl: fetchErro });
  assert.equal(r.ok, false);
  assert.ok(!JSON.stringify(r).includes("TOKEN-SECRETO"));
  assert.equal((await enviarTexto({ para: DONO, texto: "oi", env: {} })).ok, false);
});

// ─── gateway ─────────────────────────────────────────────────────────────────
function depsFalsas(extra = {}) {
  const enviados = [], fila = [], chamadas = [];
  return {
    enviados, fila, chamadas,
    autorizado: (n) => numeroAutorizado(n, env),
    enviar: async (para, texto) => { enviados.push({ para, texto }); return { ok: true }; },
    perguntar: async (p) => { chamadas.push(["perguntar", p]); return { tipo: "resposta", texto: `resposta para ${p}` }; },
    brief: async () => { chamadas.push(["brief"]); return { brief: { summary: "Boa noite.", critical: [{ titulo: "2 conta(s) vencida(s)" }], warnings: [], opportunities: [] } }; },
    enfileirar: async (item) => { fila.push(item); return { ok: true, ponteOnline: true }; },
    ...extra,
  };
}
const msg = (texto, o = {}) => ({ id: `wamid.${Math.random()}`, de: DONO, tipo: "text", texto, ts: null, ...o });

test("gateway: número não autorizado não recebe resposta e nada roda", async () => {
  limparDedupe();
  const d = depsFalsas();
  const r = await atenderMensagem(msg("como está minha empresa?", { de: "5511900000000" }), d);
  assert.equal(r.resultado, "nao_autorizado");
  assert.equal(d.enviados.length + d.chamadas.length + d.fila.length, 0);
});

test("gateway: empresa → brief; pergunta → ask; tudo responde ao próprio número", async () => {
  limparDedupe();
  const d = depsFalsas();
  await atenderMensagem(msg("Como está minha empresa?"), d);
  await atenderMensagem(msg("pergunte ao Héfisto: quanto vendi ontem?"), d);
  assert.deepEqual(d.chamadas, [["brief"], ["perguntar", "quanto vendi ontem?"]]);
  assert.match(d.enviados[0].texto, /Boa noite\.[\s\S]*\*Crítico\*[\s\S]*2 conta\(s\) vencida\(s\)/);
  assert.equal(d.enviados[1].texto, "resposta para quanto vendi ontem?");
  assert.ok(d.enviados.every((e) => e.para === DONO));
});

test("gateway: erro do core (403/429) vira a mensagem do core; exceção vira aviso genérico", async () => {
  limparDedupe();
  const d = depsFalsas({
    brief: async () => ({ erro: "Seu perfil não tem acesso à Central de Inteligência.", codigo: "SEM_PERMISSAO" }),
    perguntar: async () => { throw new Error("detalhe interno com segredo"); },
  });
  await atenderMensagem(msg("como está minha empresa"), d);
  await atenderMensagem(msg("pergunte ao hefisto: oi"), d);
  assert.equal(d.enviados[0].texto, "Seu perfil não tem acesso à Central de Inteligência.");
  assert.equal(d.enviados[1].texto, "Não consegui concluir agora. Tente de novo em instantes.");
});

test("gateway: comandos do agente vão para a fila; ponte online responde sozinha", async () => {
  limparDedupe();
  const d = depsFalsas();
  await atenderMensagem(msg("aprovar APR-3"), d);
  assert.deepEqual(d.fila[0].args, { id: "APR-003", nota: "" });
  assert.equal(d.fila[0].numero, DONO);
  assert.equal(d.enviados.length, 0, "quem responde é a ponte");

  const off = depsFalsas({ enfileirar: async () => ({ ok: true, ponteOnline: false }) });
  await atenderMensagem(msg("status"), off);
  assert.match(off.enviados[0].texto, /ponte do agente no seu computador está desligada/);

  const semFila = depsFalsas({ enfileirar: async () => ({ indisponivel: true }) });
  await atenderMensagem(msg("pare"), semFila);
  assert.match(semFila.enviados[0].texto, /APR-003/);
});

test("gateway: duplicada, antiga, sem texto, desconhecida e limite", async () => {
  limparDedupe();
  const d = depsFalsas();
  const m = msg("status");
  await atenderMensagem(m, d);
  assert.equal((await atenderMensagem(m, d)).resultado, "duplicado");
  assert.equal(d.fila.length, 1);
  const agora = Date.now();
  assert.equal((await atenderMensagem(msg("status", { ts: Math.floor(agora / 1000) - 3600 }), d, agora)).resultado, "antiga");
  await atenderMensagem(msg(null, { tipo: "image" }), d);
  assert.match(d.enviados.at(-1).texto, /só entendo mensagens de texto/);
  await atenderMensagem(msg("delete from usuarios"), d);
  assert.ok(d.enviados.at(-1).texto.startsWith("Não reconheci esse comando.") && d.enviados.at(-1).texto.includes(AJUDA));
  const lim = depsFalsas({ limite: () => false });
  assert.equal((await atenderMensagem(msg("status"), lim)).resultado, "limite");
  assert.equal(lim.fila.length, 0);
});

test("bloquearAcoes: pelo WhatsApp nenhuma ação começa nem continua", async () => {
  let chamou = false;
  const s = bloquearAcoes({ iniciar: async () => { chamou = true; }, responder: async () => { chamou = true; }, confirmar: 1 });
  assert.equal(await s.iniciar({ acaoId: "stock.registerLoss" }), ACAO_BLOQUEADA);
  assert.equal(await s.responder({}), ACAO_BLOQUEADA);
  assert.equal(chamou, false);
  assert.equal(s.confirmar, 1);
});

// ─── formatação ──────────────────────────────────────────────────────────────
test("formatar: DADOS INSUFICIENTES aparece escrito; nada é inventado", () => {
  const t = formatarResposta({ tipo: "resposta", texto: "Faturamento de ontem:", blocos: [
    { tipo: "metrica", rotulo: "Faturamento", metrica: { status: "insuficiente", motivo: "Sem vendas lançadas no período." } },
  ] });
  assert.match(t, /DADOS INSUFICIENTES/);
  assert.match(t, /Sem vendas lançadas/);
  const vazio = formatarBrief({ summary: "Bom dia.", critical: [], warnings: [], opportunities: [] });
  assert.match(vazio, /Nenhum alerta com os dados disponíveis/);
  assert.equal(formatarResposta({ tipo: "bloqueado", texto: ACAO_BLOQUEADA.texto }).includes("Central de Inteligência"), true);
});

// ─── fila (banco falso) ──────────────────────────────────────────────────────
function bancoFalso({ erroInsert = null, vistoEm = null } = {}) {
  const q = (resultado) => {
    const o = { select: () => o, eq: () => o, maybeSingle: async () => resultado, insert: async () => ({ error: erroInsert }), upsert: async () => ({ error: null }), update: () => o };
    return o;
  };
  return () => ({ from: (t) => q(t === "whatsapp_ponte" ? { data: vistoEm ? { visto_em: vistoEm } : null } : { data: null }) });
}

test("fila: sem a migração fica indisponível; duplicada; ponte online pelos últimos 2 minutos", async () => {
  assert.deepEqual(await criarFila(bancoFalso({ erroInsert: { code: "PGRST205", message: "Could not find the table" } })).enfileirar({}), { indisponivel: true });
  assert.deepEqual(await criarFila(bancoFalso({ erroInsert: { code: "23505" } })).enfileirar({}), { duplicado: true });
  const agora = Date.now();
  assert.equal((await criarFila(bancoFalso({ vistoEm: new Date(agora - 30_000).toISOString() })).enfileirar({}, agora)).ponteOnline, true);
  assert.equal((await criarFila(bancoFalso({ vistoEm: new Date(agora - 600_000).toISOString() })).enfileirar({}, agora)).ponteOnline, false);
  await assert.rejects(criarFila(bancoFalso({ erroInsert: { code: "XX000", message: "x" } })).enfileirar({}), /fila: falha ao gravar/);
});
