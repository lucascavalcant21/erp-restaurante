import { supabase, isSupabaseReady } from "./supabase";
import { fetchEstoques, fetchItensEstoque, registrarMovimentoMulti } from "./estoques-multiplos";

// Camada de AÇÕES do Assistente Hefisto.
// A IA apenas interpreta; aqui resolvemos os registros REAIS, validamos, checamos
// saldo, executamos usando os mesmos serviços das telas e gravamos auditoria.
// Nada de SQL livre e nada de id/valor inventado pelo modelo.

const norm = (s) => {
  const d = String(s || "").normalize("NFD");
  let out = "";
  for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
  return out.trim().toLowerCase();
};

export const mostrarUn = (u) => (String(u || "").toLowerCase() === "l" ? "L" : (u || "un"));
export const fmtQtd = (q) => (+Number(q || 0).toFixed(3)).toLocaleString("pt-BR");

// ─── Registro central de ações ──────────────────────────────────────────────
// nivel: 1 consulta · 2 operacional · 3 confirmação · 4 reforçada
export const ACOES = {
  navegar:            { id: "navegar",                    modulo: "core",      nivel: 1, obrigatorios: ["rota"],                   reversivel: false },
  consultar_estoque:  { id: "consultar_estoque",          modulo: "inventory", nivel: 1, obrigatorios: ["produto"],                reversivel: false },
  entrada_estoque:    { id: "inventory.create_entry",     modulo: "inventory", nivel: 3, obrigatorios: ["produto", "quantidade"],  reversivel: true },
  retirada_estoque:   { id: "inventory.create_withdrawal",modulo: "inventory", nivel: 3, obrigatorios: ["produto", "quantidade"],  reversivel: true },
};

export function camposFaltantes(acao, intencao) {
  const def = ACOES[acao];
  if (!def) return [];
  return def.obrigatorios.filter(campo => {
    const v = intencao?.[campo];
    return v === null || v === undefined || v === "" || (campo === "quantidade" && !(Number(v) > 0));
  });
}

// ─── Resolução de nomes contra dados reais ──────────────────────────────────
// Nunca escolhe no escuro: devolve {status:"ambiguo", opcoes:[...]} quando houver
// mais de um candidato plausível.
export function resolverProduto(itens, termo) {
  const alvo = norm(termo);
  if (!alvo) return { status: "nao_encontrado", opcoes: [] };
  const lista = itens || [];
  const exatos = lista.filter(i => norm(i.nome) === alvo);
  if (exatos.length === 1) return { status: "ok", item: exatos[0] };
  if (exatos.length > 1) return { status: "ambiguo", opcoes: exatos.slice(0, 6) };

  const contem = lista.filter(i => norm(i.nome).includes(alvo) || alvo.includes(norm(i.nome)));
  if (contem.length === 1) return { status: "ok", item: contem[0] };
  if (contem.length > 1) return { status: "ambiguo", opcoes: contem.slice(0, 6) };

  // Aproximação simples por prefixo/palavras (tolera "heiniken" → "heineken")
  const palavras = alvo.split(/\s+/).filter(Boolean);
  const parecidos = lista.filter(i => {
    const n = norm(i.nome);
    return palavras.some(p => p.length >= 4 && (n.includes(p.slice(0, 4)) || p.includes(n.slice(0, 4))));
  });
  if (parecidos.length === 1) return { status: "ok", item: parecidos[0] };
  if (parecidos.length > 1) return { status: "ambiguo", opcoes: parecidos.slice(0, 6) };
  return { status: "nao_encontrado", opcoes: [] };
}

// Escolhe o estoque do setor pedido (cozinha/bar) entre os estoques da unidade.
export function escolherEstoque(estoques, setor) {
  const lista = estoques || [];
  if (!lista.length) return null;
  const s = norm(setor);
  if (s) {
    const achado = lista.find(e => norm(e.slug).includes(s) || norm(e.nome).includes(s) || norm(e.tipo).includes(s));
    if (achado) return achado;
  }
  return lista[0];
}

// Carrega estoques + itens do setor. Retorna dados reais para o assistente usar.
export async function carregarContextoEstoque(unidadeId, setor) {
  const { data: estoques } = await fetchEstoques(unidadeId);
  const estoque = escolherEstoque(estoques, setor);
  if (!estoque) return { estoque: null, itens: [] };
  const { data: itens } = await fetchItensEstoque(estoque.id, unidadeId, estoque);
  return { estoque, itens: itens || [] };
}

// ─── Auditoria ──────────────────────────────────────────────────────────────
// A auditoria nunca derruba a ação principal — mas falhar calada é pior que
// falhar: o histórico simplesmente para de existir e ninguém fica sabendo.
// Por isso todo erro é impresso inteiro (mensagem, código, details e hint do
// PostgREST) e devolvido para quem chamou decidir se mostra na tela.
function detalharErroAuditoria(erro, registro) {
  const partes = [
    erro?.message,
    erro?.code ? `código ${erro.code}` : null,
    erro?.details,
    erro?.hint,
  ].filter(Boolean);
  const detalhe = partes.join(" · ") || "erro desconhecido";
  console.error(
    `[auditoria] não gravou ${registro?.modulo || "?"}/${registro?.acao || "?"}: ${detalhe}`,
    { registro, erro },
  );
  return detalhe;
}

export async function registrarAuditoria(registro) {
  if (!isSupabaseReady()) return { error: "Offline" };
  try {
    const { error } = await supabase.from("hefisto_auditoria").insert({
      unidade_id: registro.unidadeId || null,
      usuario_id: registro.usuarioId || null,
      usuario_nome: registro.usuarioNome || null,
      comando: registro.comando || null,
      intencao: registro.intencao || null,
      acao: registro.acao || null,
      modulo: registro.modulo || null,
      registro_id: registro.registroId || null,
      valor_anterior: registro.valorAnterior ?? null,
      valor_novo: registro.valorNovo ?? null,
      resultado: registro.resultado || null,
      erro: registro.erro || null,
      exigiu_confirmacao: !!registro.exigiuConfirmacao,
      dispositivo: typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 200) : null,
    });
    return { error: error ? detalharErroAuditoria(error, registro) : null };
  } catch (e) {
    return { error: detalharErroAuditoria(e, registro) };
  }
}

export async function fetchAuditoriaHefisto(unidadeId, limite = 50) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  try {
    let consulta = supabase
      .from("hefisto_auditoria")
      .select("id, usuario_nome, comando, intencao, acao, modulo, resultado, erro, exigiu_confirmacao, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(200, Number(limite) || 50)));
    if (unidadeId && unidadeId !== "todas") consulta = consulta.eq("unidade_id", unidadeId);
    const { data, error } = await consulta;
    // Lista vazia por erro e lista vazia por não ter ação são coisas diferentes:
    // sem esta distinção a tela de auditoria mente que está tudo em ordem.
    if (error) return { data: [], error: detalharErroAuditoria(error, { modulo: "leitura" }) };
    return { data: data || [], error: null };
  } catch (e) {
    return { data: [], error: detalharErroAuditoria(e, { modulo: "leitura" }) };
  }
}

// ─── Execução ───────────────────────────────────────────────────────────────
// Movimento de estoque usando o MESMO serviço das telas (registrarMovimentoMulti,
// que já tem timeout e fallback legado).
export async function executarMovimento({ tipo, unidadeId, estoque, item, quantidade, usuario, comando, intencao }) {
  const qtd = Number(quantidade);
  if (!estoque?.id || !item?.insumo_id) return { error: "Produto ou estoque inválido." };
  if (!Number.isFinite(qtd) || qtd <= 0) return { error: "Quantidade inválida." };

  const saldoAntes = Number(item.quantidade_atual) || 0;
  if (tipo === "saida" && qtd > saldoAntes) {
    return { error: `Saldo insuficiente: disponível ${fmtQtd(saldoAntes)} ${mostrarUn(item.unidade_medida)}.` };
  }

  const resposta = await registrarMovimentoMulti({
    unidadeId,
    estoqueId: estoque.id,
    insumoId: item.insumo_id,
    tipo,
    quantidade: qtd,
    usuarioId: usuario?.id || null,
    usuarioNome: usuario?.nome || usuario?.email || "Assistente Hefisto",
    observacao: `Hefisto: ${comando || ""}`.slice(0, 200),
  });

  const saldoDepois = tipo === "entrada" ? saldoAntes + qtd : Math.max(0, saldoAntes - qtd);
  await registrarAuditoria({
    unidadeId, usuarioId: usuario?.id, usuarioNome: usuario?.nome || usuario?.email,
    comando, intencao, acao: tipo === "entrada" ? ACOES.entrada_estoque.id : ACOES.retirada_estoque.id,
    modulo: "inventory", registroId: item.insumo_id,
    valorAnterior: saldoAntes, valorNovo: resposta?.error ? saldoAntes : saldoDepois,
    resultado: resposta?.error ? "erro" : "sucesso", erro: resposta?.error || null,
    exigiuConfirmacao: true,
  });

  if (resposta?.error) return { error: resposta.error };
  return { saldoAntes, saldoDepois, unidade: item.unidade_medida };
}

// Desfazer = movimento inverso (nunca apaga histórico).
export async function desfazerMovimento({ tipo, unidadeId, estoque, item, quantidade, usuario }) {
  const inverso = tipo === "entrada" ? "saida" : "entrada";
  return executarMovimento({
    tipo: inverso, unidadeId, estoque, item, quantidade, usuario,
    comando: "Desfazer lançamento do assistente",
    intencao: { acao: "desfazer", original: tipo },
  });
}
