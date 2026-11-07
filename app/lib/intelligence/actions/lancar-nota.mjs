// AÇÃO purchase.fromInvoice — lançar a compra a partir da FOTO DA DANFE
// (Assistente Héfisto, pedido do dono 07/11/2026).
//
//   foto → /api/ocr (leitura da nota) → esta ação:
//     fornecedor, nº da nota, data, itens (quantidade, unidade, valor)
//     → para cada item: qual produto do cadastro é (ou cadastrar com nome,
//       unidade, embalagem, setor e preço da nota), quanto vem em cada
//       unidade da nota (caixa de 12 × 900 ml…), em que estoque entra
//     → vencimento da conta a pagar
//     → prévia → CONFIRMAR (digitado: gera conta a pagar)
//     → compra salva e CONFIRMADA pelo mesmo caminho da tela de Compras
//       (salvarRascunho + rpc compras_confirmar: estoque + custo médio +
//       histórico + conta a pagar, tudo ou nada).
//
// Os números da leitura são da NOTA (REAL lido da foto): a prévia mostra
// tudo e avisa quando a soma dos itens não bate com o total da nota. Nada é
// gravado antes do CONFIRMAR. Cadastro e compra pelo cliente do usuário (RLS
// e permissão do banco: estoque.purchases.confirm).

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { candidatosDoTermo, CAMPOS_INSUMO } from "../metrics/produtos.mjs";
import { localDoSetor } from "./registrar-entrada.mjs";
import { calcularPrecoNormalizado } from "../../ingredientes-utils.mjs";
import { salvarRascunho, confirmarCompra, criarFornecedor } from "../../compras-estoque.mjs";

export const MAX_ITENS_NOTA = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, c = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: c });
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const r6 = (n) => Math.round(Number(n) * 1e6) / 1e6;
const dobrar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

/** Hoje no fuso da unidade (o servidor roda em UTC). */
export function hojeNoFuso(agora = new Date(), fuso = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

// ─── Leitura da nota (vinda do /api/ocr) ─────────────────────────────────────
const itemNota = s.object({
  codigo: s.opcional(s.string({ max: 40 })),
  nome: s.string({ min: 1, max: 160 }),
  un: s.opcional(s.string({ max: 12 })),
  qtd: s.number({ min: 0.0001, max: 1000000 }),
  valor_unitario: s.opcional(s.number({ min: 0, max: 10000000 })),
  preco: s.number({ min: 0, max: 10000000 }), // valor TOTAL da linha
});
export const notaSchema = s.object({
  fornecedor: s.opcional(s.string({ max: 160 })),
  cnpj: s.opcional(s.string({ max: 24 })),
  numero: s.opcional(s.string({ max: 20 })),
  serie: s.opcional(s.string({ max: 10 })),
  chave_acesso: s.opcional(s.string({ max: 60 })),
  data_emissao: s.opcional(s.string({ max: 10 })),
  valor_total: s.opcional(s.number({ min: 0, max: 100000000 })),
  valor_frete: s.opcional(s.number({ min: 0, max: 10000000 })),
  valor_desconto: s.opcional(s.number({ min: 0, max: 10000000 })),
  vencimentos: s.opcional(s.array(s.object({ data: s.string({ max: 10 }), valor: s.opcional(s.number({ min: 0, max: 100000000 })) }), { max: 24 })),
  itens: s.array(itemNota, { min: 1, max: MAX_ITENS_NOTA }),
});

// ─── Unidades e tamanhos ─────────────────────────────────────────────────────
const UN_NOTA = { kg: "kg", kgs: "kg", g: "g", gr: "g", l: "l", lt: "l", lts: "l", ml: "ml", un: "un", und: "un", unid: "un", pc: "un", pca: "un", pç: "un", peca: "un" };
const FAMILIA = { kg: "m", g: "m", l: "v", ml: "v", un: "u", garrafa: "u", lata: "u" };
const FATOR = { kg: 1000, g: 1, l: 1000, ml: 1, un: 1, garrafa: 1, lata: 1 };

/** Converte entre unidades da mesma família (kg↔g, l↔ml, un). Incompatível → null. */
export function converter(q, de, para) {
  const a = String(de || "").toLowerCase();
  const b = String(para || "").toLowerCase();
  if (!FAMILIA[a] || !FAMILIA[b] || FAMILIA[a] !== FAMILIA[b]) return null;
  return (Number(q) * FATOR[a]) / FATOR[b];
}

/**
 * Tamanho escrito na descrição: "OLEO SOJA 900ML" → 900 ml; "CX 12X1L" → 12 × 1 l;
 * "ARROZ 5KG FD C/6" → 6 × 5 kg. Devolve { porUnidade: {q,u}, pacote } ou null.
 */
export function tamanhoNaDescricao(descricao) {
  const f = dobrar(descricao).replace(/(\d),(\d)/g, "$1.$2");
  const m = [...f.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|gr|ml|l|lt)\b/g)];
  if (!m.length) return null;
  const ult = m[m.length - 1];
  const porUnidade = { q: Number(ult[1]), u: UN_NOTA[ult[2]] };
  const pac = f.match(/\b(?:c\/|cx\s*c\/|com\s+|x\s*)(\d{1,3})\b|\b(\d{1,3})\s*(?:x|un\b|und\b|unid\b)/);
  const pacote = pac ? Number(pac[1] || pac[2]) : 1;
  return porUnidade.q > 0 ? { porUnidade, pacote: pacote > 0 && pacote < 500 ? pacote : 1 } : null;
}

/** Resposta "12 x 900 ml", "10,8 litros", "5 kg", "24" → quantidade na unidade pedida. */
export function lerConteudo(texto, unidadeAlvo) {
  const f = dobrar(texto).replace(/(\d),(\d)/g, "$1.$2");
  const nums = [...f.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|gr|ml|l|lt|litros?|quilos?|gramas?|un|unidades?)?/g)]
    .map((x) => ({ n: Number(x[1]), u: x[2] ? (UN_NOTA[x[2]] || (/^litro/.test(x[2]) ? "l" : /^quilo/.test(x[2]) ? "kg" : /^grama/.test(x[2]) ? "g" : "un")) : null }))
    .filter((x) => x.n > 0);
  if (!nums.length) return null;
  const alvo = String(unidadeAlvo || "un").toLowerCase();
  if (nums.length >= 2 && (!nums[0].u || nums[0].u === "un") && nums[1].u) {
    const v = converter(nums[0].n * nums[1].n, nums[1].u, alvo);
    return v > 0 ? r6(v) : null;
  }
  const x = nums[0];
  const v = x.u ? converter(x.n, x.u, alvo) : x.n;
  return v > 0 ? r6(v) : null;
}

/** "20/11", "20/11/2026", "2026-11-20", "hoje" → ISO; passado do ano corrente vira o ano seguinte só se ficar antes da compra. */
export function lerData(texto, hoje) {
  const f = dobrar(texto).trim();
  if (/^(hoje|a vista|avista|ja paguei|pago|paguei)/.test(f) || f === "hoje") return hoje;
  let m = f.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = f.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  const ano = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : hoje.slice(0, 4);
  const iso = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) ? iso : null;
}

// palavras de embalagem/medida que a nota escreve e o cadastro não
const RUIDO_NOTA = new Set(["cx", "caixa", "un", "und", "unid", "pct", "pacote", "fd", "fardo", "pc", "pca", "c", "com", "lata", "lt", "pet", "garrafa", "gf", "sc", "saco", "bd", "bdj", "bandeja", "kg", "g", "gr", "ml", "l", "tp", "tipo", "de", "da", "do", "e"]);

/**
 * Termos de busca da descrição da nota, do mais completo ao mais curto:
 * "OLEO SOJA 900ML CX C/6" → ["oleo soja", "oleo"]. Sem números, medidas e embalagem.
 */
export function termosDaNota(nome) {
  const ws = dobrar(nome).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !/\d/.test(w) && !RUIDO_NOTA.has(w) && w.length > 1);
  const out = [];
  for (const n of [ws.length, 3, 2, 1]) if (n > 0 && n <= ws.length) out.push(ws.slice(0, n).join(" "));
  return [...new Set(out)];
}

/** Candidatos do cadastro para um item da nota (descrição suja → busca em cascata). */
export function candidatosDaNota(insumos, nome, termo = null) {
  if (termo) return candidatosDoTermo(insumos, termo, 5);
  for (const t of termosDaNota(nome)) {
    const c = candidatosDoTermo(insumos, t, 5);
    if (c.length) return c;
  }
  return [];
}

/** Preço por unidade legível: por ml/g vira por L/kg ("R$ 9,89/L" em vez de "R$ 0,01/ml"). */
export function precoLegivel(preco, unidade) {
  if (unidade === "ml") return `${brl(preco * 1000)}/L`;
  if (unidade === "g") return `${brl(preco * 1000)}/kg`;
  return `${brl(preco)}/${unidade === "l" ? "L" : unidade}`;
}

/** Nome limpo para o cadastro: "OLEO SOJA LIZA 900ML" → "Oleo soja liza 900ml". */
const nomeCadastro = (t) => { const x = String(t || "").replace(/\s+/g, " ").trim().toLowerCase(); return x ? x[0].toUpperCase() + x.slice(1) : x; };

// ─── Parâmetros ──────────────────────────────────────────────────────────────
const resolucao = s.object({
  insumoId: s.opcional(s.uuid()),
  novo: s.opcional(s.boolean()),
  ignorar: s.opcional(s.boolean()),
  termo: s.opcional(s.string({ max: 80 })),
  departamento: s.opcional(s.enum(["cozinha", "bar"])),
  conteudo: s.opcional(s.number({ min: 0.000001, max: 10000000 })),
  estoqueId: s.opcional(s.uuid()),
});

export const paramsSchema = s.object({
  nota: notaSchema,
  res: s.opcional(s.array(resolucao, { max: MAX_ITENS_NOTA })),
  vencimento: s.opcional(s.string({ max: 10 })),
  pendente: s.opcional(s.object({ tipo: s.string({ max: 20 }), indice: s.opcional(s.number({ min: 0, max: MAX_ITENS_NOTA, inteiro: true })), unidade: s.opcional(s.string({ max: 12 })) })),
  aviso: s.opcional(s.string({ max: 200 })),
  resposta: s.opcional(s.string({ min: 1, max: 120 })),
});

export function aplicarResposta(params, campo, valor) {
  const p = { ...params, res: [...(params.res || [])].map((x) => ({ ...x })), aviso: null, resposta: null };
  const n = p.nota?.itens?.length || 0;
  while (p.res.length < n) p.res.push({});
  const pend = params.pendente || {};
  const i = pend.indice;
  const r = Number.isInteger(i) ? p.res[i] : null;
  const v = String(valor ?? "").trim();
  const f = dobrar(v);
  switch (pend.tipo) {
    case "produto":
      if (!r) break;
      if (v === "ignorar" || /^(nao lancar|nao lanca|ignorar|pular)/.test(f)) { r.ignorar = true; break; }
      if (v === "novo" || /^(cadastrar|novo)/.test(f)) { r.novo = true; delete r.insumoId; break; }
      if (/^i:/.test(v) && UUID.test(v.slice(2))) { r.insumoId = v.slice(2); delete r.novo; break; }
      if (v.length >= 2) { r.termo = v.slice(0, 80); delete r.insumoId; delete r.novo; } else p.aviso = "Não entendi qual produto é.";
      break;
    case "setor":
      if (!r) break;
      if (/bar|bebida/.test(f)) r.departamento = "bar";
      else if (/cozinha/.test(f)) r.departamento = "cozinha";
      else p.aviso = "É da Cozinha ou do Bar?";
      break;
    case "conteudo": {
      if (!r) break;
      const c = lerConteudo(v, pend.unidade || params.pendente?.unidade);
      if (c) r.conteudo = c; else p.aviso = "Não entendi quanto vem.";
      break;
    }
    case "estoque":
      if (!r) break;
      if (UUID.test(v)) r.estoqueId = v; else p.aviso = "Escolha um dos locais.";
      break;
    case "vencimento":
      p.vencimento = v === "hoje" ? "hoje" : v.slice(0, 10);
      break;
    default:
      break;
  }
  return p;
}

const pergunta = (tipo, texto, { indice = null, opcoes = null, aviso = null, extra = {} } = {}) => ({
  faltando: {
    campo: "resposta", texto: aviso ? `${aviso} ${texto}` : texto, opcoes, livre: true,
    persistir: { pendente: { tipo, ...(indice != null ? { indice } : {}), ...extra }, aviso: null },
  },
});

// ─── Preparar ────────────────────────────────────────────────────────────────
async function preparar(ctx, params) {
  const p = params || {};
  const nota = p.nota;
  const aviso = p.aviso || null;
  const res = [...(p.res || [])];
  const hoje = hojeNoFuso(new Date(), ctx.escopo?.fuso || "America/Sao_Paulo");

  const insumos = (await ler(ctx.dbe.from("insumos").select(`${CAMPOS_INSUMO}, departamento`).order("nome"), "insumos")) || [];
  const insPorId = new Map(insumos.map((x) => [x.id, x]));
  const estoques = ((await ler(ctx.dbe.from("estoques").select("id, nome, status"), "estoques")) || []).filter((e) => (e.status || "ativo") === "ativo");
  const estoqueItens = (await ler(ctx.dbe.from("estoque_itens").select("estoque_id, insumo_id"), "estoque_itens")) || [];
  const fornecedores = (await ler(ctx.dbe.from("fornecedores").select("id, nome, ativo"), "fornecedores")) || [];

  // fornecedor: pelo nome da nota; sem cadastro, é criado junto
  const fornNome = String(nota.fornecedor || "").trim();
  const fornecedor = fornNome ? candidatosDoTermo(fornecedores, fornNome, 1)[0] || null : null;

  // nota repetida (mesmo número, não cancelada): não lança de novo
  if (nota.numero) {
    const ja = (await ler(ctx.dbe.from("compras").select("id, numero_documento, status, fornecedor_id, data_compra").eq("numero_documento", String(nota.numero).trim()), "compras")) || [];
    const dup = ja.find((c) => c.status !== "cancelada" && (!fornecedor || !c.fornecedor_id || c.fornecedor_id === fornecedor.id));
    if (dup) return { erro: `A nota ${nota.numero} já foi lançada em Compras (${ddmm(String(dup.data_compra).slice(0, 10))}, ${dup.status}). Nada foi lançado de novo.` };
  }
  const dataCompra = /^\d{4}-\d{2}-\d{2}$/.test(String(nota.data_emissao || "")) && nota.data_emissao <= hoje ? nota.data_emissao : hoje;

  const linhas = [];
  for (let i = 0; i < nota.itens.length; i++) {
    const it = nota.itens[i];
    const r = res[i] || {};
    if (r.ignorar) continue;
    const unNota = UN_NOTA[dobrar(it.un).replace(/[^a-z]/g, "")] || null; // CX, PCT, FD… = null (embalagem)
    const rotuloUn = String(it.un || "un").toUpperCase();

    // 1. Qual produto
    let ins = r.insumoId ? insPorId.get(r.insumoId) : null;
    if (r.insumoId && !ins) return { erro: `O produto escolhido para "${it.nome}" não existe nesta unidade.` };
    if (!ins && !r.novo) {
      const c = candidatosDaNota(insumos, it.nome, r.termo || null);
      // casa sozinho só quando o nome do cadastro é exatamente o da nota (sem medidas/embalagem)
      const exato = c.length === 1 && termosDaNota(it.nome)[0] === dobrar(c[0].nome).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      if (exato || (c.length === 1 && r.termo)) ins = c[0];
      else {
        return pergunta("produto", c.length
          ? `Item ${i + 1} da nota: "${it.nome}" (${num(it.qtd)} ${rotuloUn}, ${brl(it.preco)}). Qual produto do cadastro é?`
          : `Item ${i + 1} da nota: "${it.nome}" (${num(it.qtd)} ${rotuloUn}, ${brl(it.preco)}) não está no cadastro. Cadastro como novo? Se já existe com outro nome, escreva o nome.`, {
          indice: i, aviso,
          opcoes: [...c.map((x) => ({ id: `i:${x.id}`, rotulo: x.nome })), { id: "novo", rotulo: `Cadastrar "${nomeCadastro(it.nome)}"` }, { id: "ignorar", rotulo: "Não lançar este item" }],
        });
      }
    }

    // 2. Produto novo: setor e como ele é controlado
    let novo = null;
    if (!ins && r.novo) {
      if (!r.departamento) return pergunta("setor", `"${nomeCadastro(it.nome)}" é da Cozinha ou do Bar?`, { indice: i, aviso, opcoes: [{ id: "cozinha", rotulo: "Cozinha" }, { id: "bar", rotulo: "Bar" }] });
      const tam = tamanhoNaDescricao(it.nome);
      // unidade do cadastro: a da nota (kg, L…) ou a do tamanho escrito (900 ml); senão unidade
      const unidade = unNota && unNota !== "un" ? unNota : tam ? tam.porUnidade.u : "un";
      const tamanho = unNota && unNota !== "un" ? 1 : tam ? tam.porUnidade.q : 1;
      novo = { nome: nomeCadastro(it.nome), departamento: r.departamento, unidade_medida: unidade, tamanho_embalagem: tamanho };
      ins = { id: null, nome: novo.nome, unidade_medida: unidade, departamento: r.departamento };
    }

    // 3. Quanto entra (unidade do cadastro) por unidade da nota
    const unCad = String(ins.unidade_medida || "un").toLowerCase();
    let conteudo = r.conteudo || null;
    if (!conteudo && unNota) conteudo = converter(1, unNota, unCad);
    if (!conteudo) {
      const tam = tamanhoNaDescricao(it.nome);
      const porUn = tam ? converter(tam.porUnidade.q, tam.porUnidade.u, unCad) : null;
      if (porUn) conteudo = r6(porUn * (unNota === "un" ? 1 : tam.pacote));
      else if (FAMILIA[unCad] === "u" && unNota === "un") conteudo = 1;
    }
    if (!conteudo) {
      return pergunta("conteudo", `Cada ${rotuloUn} de ${ins.nome} tem quanto, em ${unCad}? (ex.: "12 x 900 ml", "5 kg", "24")`, { indice: i, aviso, extra: { unidade: unCad } });
    }

    // 4. Em que estoque entra
    let estoqueId = r.estoqueId || null;
    if (!estoqueId) {
      const onde = ins.id ? [...new Set(estoqueItens.filter((e) => e.insumo_id === ins.id).map((e) => e.estoque_id))].filter((id) => estoques.some((e) => e.id === id)) : [];
      const principal = localDoSetor(estoques, ins);
      if (onde.length === 1) estoqueId = onde[0];
      else if (principal && (!onde.length || onde.includes(principal.id))) estoqueId = principal.id;
      else if (estoques.length === 1) estoqueId = estoques[0].id;
      else {
        const lista = onde.length ? estoques.filter((e) => onde.includes(e.id)) : estoques;
        return pergunta("estoque", `Em qual estoque ${ins.nome} entra?`, { indice: i, aviso, opcoes: lista.slice(0, 8).map((e) => ({ id: e.id, rotulo: e.nome })) });
      }
    }

    const qtdCad = r6(it.qtd * conteudo);
    linhas.push({ i, it, ins, novo, conteudo, qtdCad, estoqueId, precoCad: qtdCad > 0 ? it.preco / qtdCad : null });
  }
  if (!linhas.length) return { erro: "Nenhum item ficou para lançar: a compra não foi criada." };

  // 5. Vencimento da conta a pagar
  let venc = p.vencimento === "hoje" ? hoje : p.vencimento ? lerData(p.vencimento, hoje) : null;
  if (p.vencimento && !venc) return pergunta("vencimento", "Qual o vencimento? (ex.: 20/11)", { aviso: "Não entendi a data.", opcoes: [{ id: "hoje", rotulo: "Paguei hoje (à vista)" }] });
  if (!venc) {
    const v = (nota.vencimentos || []).map((x) => x.data).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0];
    if (v) venc = v;
  }
  if (!venc) return pergunta("vencimento", "Quando vence o pagamento desta nota? (ex.: 20/11)", { aviso, opcoes: [{ id: "hoje", rotulo: "Paguei hoje (à vista)" }] });
  if (venc < dataCompra) return pergunta("vencimento", `O vencimento (${ddmm(venc)}) ficou antes da data da nota (${ddmm(dataCompra)}). Qual é o vencimento?`, { opcoes: [{ id: "hoje", rotulo: "Paguei hoje (à vista)" }] });

  // 6. Conferência dos valores lidos
  const soma = r2(linhas.reduce((s, l) => s + l.it.preco, 0));
  const frete = r2(nota.valor_frete || 0);
  const desconto = r2(nota.valor_desconto || 0);
  const total = r2(soma + frete - desconto);
  const ignorados = nota.itens.length - linhas.length;
  const avisos = [];
  if (nota.valor_total && !ignorados && Math.abs(nota.valor_total - total) > 0.05) avisos.push(`A soma lida (${brl(total)}) não bate com o total da nota (${brl(nota.valor_total)}). Confira os itens antes de confirmar.`);
  for (const l of linhas) if (l.it.valor_unitario && Math.abs(l.it.valor_unitario * l.it.qtd - l.it.preco) > 0.05 + l.it.preco * 0.01) avisos.push(`${l.ins.nome}: ${num(l.it.qtd)} × ${brl(l.it.valor_unitario)} não dá ${brl(l.it.preco)}.`);

  const nomeEst = new Map(estoques.map((e) => [e.id, e.nome]));
  const rot = (u) => (u === "l" ? "L" : u);
  const linhasPrevia = [
    { rotulo: "Fornecedor", valor: fornecedor ? fornecedor.nome : fornNome ? `${fornNome} (novo)` : "Não informado" },
    { rotulo: "Nota", valor: `${nota.numero ? `NF ${nota.numero}` : "sem número"} · ${ddmm(dataCompra)}` },
    ...linhas.map((l) => ({
      rotulo: `${l.ins.nome}${l.novo ? " (novo)" : ""}`,
      valor: `${num(l.qtdCad)} ${rot(String(l.ins.unidade_medida).toLowerCase())} · ${brl(l.it.preco)}${l.precoCad ? ` (${precoLegivel(l.precoCad, String(l.ins.unidade_medida).toLowerCase())})` : ""} · ${nomeEst.get(l.estoqueId) || "—"}`,
    })),
    ...(ignorados ? [{ rotulo: "Fora do lançamento", valor: `${ignorados} item(ns)` }] : []),
    ...(frete ? [{ rotulo: "Frete", valor: brl(frete) }] : []),
    ...(desconto ? [{ rotulo: "Desconto", valor: `− ${brl(desconto)}` }] : []),
    { rotulo: "Total da compra", valor: brl(total) },
    { rotulo: "Conta a pagar", valor: `${brl(total)} · vence ${ddmm(venc)}${venc === hoje ? " (dê baixa do pagamento no Financeiro)" : ""}` },
    ...avisos.map((a) => ({ rotulo: "Atenção", valor: a })),
  ];

  return {
    pronto: {
      preview: {
        titulo: "Lançar compra da nota", entidade: null, linhas: linhasPrevia,
        impacto: { texto: `Entra no estoque, atualiza o custo médio e cria a conta a pagar de ${brl(total)}.` },
      },
      payload: {
        unidade_id: ctx.escopo.unidadeId,
        fornecedor: fornecedor ? { id: fornecedor.id } : fornNome ? { nome: fornNome.slice(0, 120) } : null,
        compra: { numero_documento: nota.numero ? String(nota.numero).trim() : null, data_compra: dataCompra, data_recebimento: hoje, data_vencimento: venc, valor_frete: frete, valor_desconto: desconto, forma_pagamento: venc === hoje ? null : "a_prazo", observacao: "Lançada pela foto da nota (Assistente Héfisto)." },
        hoje,
        itens: linhas.map((l) => ({
          insumo_id: l.ins.id, nome: l.ins.nome, unidade_medida: l.ins.unidade_medida, estoque_id: l.estoqueId,
          embalagens: l.it.qtd, conteudo: l.conteudo, valor_total: r2(l.it.preco),
          novo: l.novo ? {
            ...l.novo, custo_compra: r2(l.precoCad * l.novo.tamanho_embalagem), custo_unitario: r6(l.precoCad),
            preco_normalizado: calcularPrecoNormalizado(l.novo.tamanho_embalagem, l.novo.unidade_medida, r2(l.precoCad * l.novo.tamanho_embalagem)),
            categoria: "Outros", tipo: "ingrediente",
          } : null,
        })),
        resumo: { total, itens: linhas.length, novos: linhas.filter((l) => l.novo).length, numero: nota.numero || null, vencimento: venc },
      },
    },
  };
}

// ─── Executar ────────────────────────────────────────────────────────────────
async function executar(ctx, payload, { chave } = {}) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  const db = ctx.dbUsuario;
  const unidade = ctx.escopo.unidadeId;
  // fornecedor novo
  let fornecedorId = payload.fornecedor?.id || null;
  if (!fornecedorId && payload.fornecedor?.nome) {
    const { data: ja } = await db.from("fornecedores").select("id").eq("unidade_id", unidade).eq("nome", payload.fornecedor.nome).maybeSingle();
    if (ja?.id) fornecedorId = ja.id;
    else {
      const f = await criarFornecedor(db, { unidade_id: unidade, nome: payload.fornecedor.nome });
      if (f.error) return { ok: false, erro: `Não consegui cadastrar o fornecedor: ${f.error}` };
      fornecedorId = f.data.id;
    }
  }
  // produtos novos (reaproveita se o mesmo nome já existe)
  const itens = [];
  let novos = 0;
  for (const it of payload.itens) {
    let id = it.insumo_id;
    if (!id && it.novo) {
      const { data: ja } = await db.from("insumos").select("id").eq("unidade_id", unidade).eq("nome", it.novo.nome).maybeSingle();
      if (ja?.id) id = ja.id;
      else {
        const { data, error } = await db.from("insumos").insert([{ ...it.novo, unidade_id: unidade, preco_atualizado_em: new Date().toISOString() }]).select("id").single();
        if (error || !data?.id) return { ok: false, erro: `Não consegui cadastrar ${it.novo.nome}: ${error?.message || "sem resposta do banco"}.` };
        id = data.id;
        novos += 1;
      }
    }
    itens.push({ insumo: { id, nome: it.nome, unidade_medida: it.unidade_medida }, estoque_id: it.estoque_id, embalagens: it.embalagens, conteudo: it.conteudo, valor_total: it.valor_total });
  }
  // compra pelo mesmo caminho da tela de Compras
  const sal = await salvarRascunho(db, { compra: { ...payload.compra, unidade_id: unidade, fornecedor_id: fornecedorId }, itens, chave: String(chave || "").slice(0, 80) }, { hoje: payload.hoje });
  if (sal.error) return { ok: false, erro: `Não consegui salvar a compra: ${sal.error}` };
  const conf = await confirmarCompra(db, { compra_id: sal.data.id, gerar_conta_pagar: true, data_vencimento: payload.compra.data_vencimento });
  if (conf.error) {
    return { ok: true, resultado: { ...payload.resumo, compraId: sal.data.id, confirmada: false, erroConfirmacao: conf.error, novos }, antes: null, depois: { compraId: sal.data.id } };
  }
  return { ok: true, resultado: { ...payload.resumo, compraId: sal.data.id, confirmada: true, contaPagarId: conf.data?.conta_pagar_id || null, entradas: conf.data?.entradas_estoque ?? null, novos }, antes: null, depois: { compraId: sal.data.id } };
}

function resumoResultado(rec) {
  const r = rec.resultado || {};
  const linhas = [
    { rotulo: "Nota", valor: r.numero ? `NF ${r.numero}` : "sem número" },
    { rotulo: "Itens", valor: String(r.itens) },
    ...(r.novos ? [{ rotulo: "Produtos cadastrados", valor: String(r.novos) }] : []),
    { rotulo: "Total", valor: brl(r.total) },
    ...(r.confirmada ? [{ rotulo: "Conta a pagar", valor: `vence ${ddmm(r.vencimento)}` }] : []),
  ];
  if (!r.confirmada) {
    return {
      texto: `Compra salva em rascunho, mas não foi confirmada: ${r.erroConfirmacao}. Abra Compras para conferir e confirmar.`,
      linhas, acoes: [{ rotulo: "Abrir Compras", rota: "/dashboard/operacao/estoque/compras" }], sugestoes: [],
    };
  }
  return {
    texto: "Compra lançada: entrou no estoque, o custo médio foi atualizado e a conta a pagar foi criada.",
    linhas,
    acoes: [{ rotulo: "Abrir Compras", rota: "/dashboard/operacao/estoque/compras" }],
    sugestoes: ["Quais produtos estão abaixo do mínimo?", "Quais contas vencem nos próximos dias?"],
  };
}

export const lancarNota = Object.freeze({
  id: "purchase.fromInvoice",
  nome: "Lançar compra pela foto da nota",
  descricao: "Lê a DANFE, cadastra o que falta e confirma a compra: estoque, custo médio e conta a pagar.",
  modulo: "compras",
  capacidade: "confirmar_compra",
  risco: "HIGH",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["nota", "res", "vencimento", "pendente", "aviso", "resposta"],
  validacoes: [
    "nota repetida (mesmo número) não é lançada de novo",
    "cada item ligado a um produto do cadastro (ou cadastrado junto, com setor, unidade, embalagem e preço da nota)",
    "quantidade convertida para a unidade do cadastro (caixa × conteúdo)",
    "soma dos itens conferida com o total da nota",
    "confirmação pela RPC compras_confirmar (permissão estoque.purchases.confirm)",
  ],
  rollback: "Cancelar a compra em Compras (confirmada: administrador + PIN desfaz estoque, custo e conta a pagar).",
  paramsSchema,
  aplicarResposta,
  preparar,
  executar,
  resumoResultado,
});
