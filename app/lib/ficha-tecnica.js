import { supabase, isSupabaseReady } from "./supabase";
import { proximoCodigoFicha, proximaVersao } from "./ficha-calculos.mjs";

// Acesso às partes novas da ficha técnica: etapas do preparo, equipamentos,
// alergênicos, armazenamento, montagem e versões.
//
// Tudo aqui trabalha sobre a MESMA ficha de `fichas_tecnicas` que a tela de
// edição já usa — as tabelas novas apenas penduram informação nela pelo
// `ficha_id`. Nada substitui nem duplica o que já existe.
//
// Enquanto `db/migracao_ficha_tecnica_completa.sql` não for rodado no Supabase,
// as funções degradam em silêncio (devolvem vazio em vez de estourar), do mesmo
// jeito que `ficha-custos.js` faz. A tela continua funcionando.

const erroTexto = e => e?.message || null;

// Erro típico de tabela ou coluna que ainda não existe (migração não rodada).
function estruturaAusente(e) {
  const m = (e?.message || e || "").toString().toLowerCase();
  return m.includes("does not exist")
    || m.includes("could not find")
    || m.includes("schema cache")
    || m.includes("relation");
}

// ─── Listas de referência ───────────────────────────────────────────────────

// Alergênicos de declaração obrigatória (RDC 727/2022) + "outros".
export const ALERGENICOS = [
  "Glúten", "Leite", "Ovos", "Soja", "Amendoim", "Castanhas",
  "Peixe", "Crustáceos", "Moluscos", "Gergelim", "Outros",
];

export const EQUIPAMENTOS_SUGERIDOS = [
  "Chapa", "Fritadeira", "Forno", "Fogão", "Panela", "Frigideira",
  "Liquidificador", "Processador", "Balança", "Faca", "Tábua de corte",
  "Espátula", "GN", "Batedeira", "Coifa", "Micro-ondas",
];

// Método do drink. Batido e mexido não são estilo: mudam o resultado no copo —
// o shaker aera, gela e dilui mais; o mixing glass mantém límpido e com corpo.
//
// Mora aqui, e não na tela, porque a listagem e a ficha técnica gravam o mesmo
// `fichas_tecnicas.metodo_bar`: duas listas separadas acabariam divergindo nos
// ids, e o id é o que vai para o banco.
export const METODOS_BAR = [
  { id: "batido", nome: "Batido (shaker)", ajuda: "Suco, xarope, creme ou clara de ovo" },
  { id: "mexido", nome: "Mexido (mixing glass)", ajuda: "Só destilados — límpido e sedoso" },
  { id: "montado", nome: "Montado no copo", ajuda: "Direto no copo do cliente, sem transferir" },
  { id: "liquidificador", nome: "Liquidificador", ajuda: "Frozen e batidas com gelo triturado" },
  { id: "dose", nome: "Dose pura", ajuda: "Servido puro, sem preparo" },
];
export const metodoBar = (id) => METODOS_BAR.find(m => m.id === id) || null;

// Tipos de gelo — muda diluição e apresentação, não é detalhe.
export const TIPOS_GELO = [
  "Sem gelo", "Cubo", "Cubo grande", "Triturado (crushed)", "Esfera", "Gelo seco",
];

export const STATUS_FICHA = [
  { valor: "ativa", rotulo: "Ativa" },
  { valor: "inativa", rotulo: "Inativa" },
  { valor: "rascunho", rotulo: "Rascunho" },
];

// ─── Leitura ────────────────────────────────────────────────────────────────

// Lê uma ficha existente com tudo que pendura nela. `fichas_ingredientes` e
// `insumos` vêm no mesmo select usado por fetchFichas, para os custos baterem.
export async function fetchFichaCompleta(fichaId) {
  if (!isSupabaseReady() || !fichaId) return { data: null, error: "Offline" };

  const { data: ficha, error } = await supabase
    .from("fichas_tecnicas")
    .select(`
      *,
      fichas_ingredientes!ficha_id(
        *,
        insumos(id, nome, unidade_medida, custo_unitario, peso_medio_g, perda_pct,
                empanado, ganho_pct, custo_empanado_kg)
      )
    `)
    .eq("id", fichaId)
    .single();

  if (error) return { data: null, error: erroTexto(error) };

  // As tabelas novas são opcionais: se a migração não rodou, cada uma volta
  // vazia e a ficha abre do mesmo jeito.
  const [etapas, equipamentos, alergenicos, armazenamento, montagem] = await Promise.all([
    fetchEtapas(fichaId),
    fetchEquipamentos(fichaId),
    fetchAlergenicos(fichaId),
    fetchArmazenamento(fichaId),
    fetchMontagemPassos(fichaId),
  ]);

  return {
    data: {
      ...ficha,
      etapas: etapas.data,
      equipamentos: equipamentos.data,
      alergenicos: alergenicos.data,
      armazenamento: armazenamento.data,
      montagem_passos: montagem.data,
    },
    // `migracaoPendente` deixa a tela avisar o usuário em vez de fingir que
    // salvou algo que o banco ainda não sabe guardar.
    migracaoPendente: [etapas, equipamentos, alergenicos, armazenamento, montagem]
      .some(r => r.error === "sem_tabela"),
    error: null,
  };
}

async function lerFilhas(tabela, fichaId, ordenacao) {
  if (!isSupabaseReady() || !fichaId) return { data: [], error: null };
  let query = supabase.from(tabela).select("*").eq("ficha_id", fichaId);
  if (ordenacao) query = query.order(ordenacao, { ascending: true });
  const { data, error } = await query;
  if (error) return { data: [], error: estruturaAusente(error) ? "sem_tabela" : erroTexto(error) };
  return { data: data || [], error: null };
}

export const fetchEtapas = (fichaId) => lerFilhas("fichas_etapas", fichaId, "ordem");
export const fetchEquipamentos = (fichaId) => lerFilhas("fichas_equipamentos", fichaId, "ordem");
export const fetchAlergenicos = (fichaId) => lerFilhas("fichas_alergenicos", fichaId, null);
export const fetchMontagemPassos = (fichaId) => lerFilhas("fichas_montagem_passos", fichaId, "ordem");

export async function fetchArmazenamento(fichaId) {
  if (!isSupabaseReady() || !fichaId) return { data: null, error: null };
  const { data, error } = await supabase
    .from("fichas_armazenamento").select("*").eq("ficha_id", fichaId).maybeSingle();
  if (error) return { data: null, error: estruturaAusente(error) ? "sem_tabela" : erroTexto(error) };
  return { data: data || null, error: null };
}

export async function fetchVersoes(fichaId) {
  if (!isSupabaseReady() || !fichaId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("fichas_versoes").select("*")
    .eq("ficha_id", fichaId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { data: [], error: estruturaAusente(error) ? "sem_tabela" : erroTexto(error) };
  return { data: data || [], error: null };
}

// ─── Escrita: substitui a lista inteira da ficha ────────────────────────────

// Apaga e regrava. Guarda o que existia antes: se o INSERT falhar, devolve a
// lista anterior, para uma falha de rede nunca deixar a ficha pela metade.
async function regravarLista(tabela, fichaId, unidadeId, linhas) {
  if (!isSupabaseReady() || !fichaId) return { error: "Offline" };

  const { data: anteriores } = await supabase.from(tabela).select("*").eq("ficha_id", fichaId);

  const { error: erroExclusao } = await supabase.from(tabela).delete().eq("ficha_id", fichaId);
  if (erroExclusao) {
    if (estruturaAusente(erroExclusao)) return { error: "sem_tabela" };
    return { error: erroTexto(erroExclusao) };
  }

  if (!linhas || linhas.length === 0) return { error: null };

  const payload = linhas.map(linha => ({ ...linha, ficha_id: fichaId, unidade_id: unidadeId || null }));
  const { error: erroInsercao } = await supabase.from(tabela).insert(payload);

  if (erroInsercao) {
    if (anteriores?.length) {
      const restaurar = anteriores.map(({ id, created_at, updated_at, ...resto }) => resto);
      await supabase.from(tabela).insert(restaurar);
    }
    if (estruturaAusente(erroInsercao)) return { error: "sem_tabela" };
    return { error: erroTexto(erroInsercao) };
  }
  return { error: null };
}

export function salvarEtapas(fichaId, unidadeId, etapas = []) {
  const linhas = etapas
    .filter(e => String(e?.titulo || "").trim() || String(e?.instrucao || "").trim())
    .map((e, i) => ({
      ordem: i + 1,
      titulo: String(e.titulo || "").trim() || null,
      instrucao: String(e.instrucao || "").trim() || null,
      tempo_min: e.tempo_min === "" || e.tempo_min == null ? null : Number(e.tempo_min) || null,
      temperatura: String(e.temperatura || "").trim() || null,
      equipamento: String(e.equipamento || "").trim() || null,
      foto_url: e.foto_url || null,
      observacao: String(e.observacao || "").trim() || null,
    }));
  return regravarLista("fichas_etapas", fichaId, unidadeId, linhas);
}

export function salvarEquipamentos(fichaId, unidadeId, nomes = []) {
  // Sem repetir o mesmo equipamento (o índice único no banco recusaria).
  const vistos = new Set();
  const linhas = [];
  nomes.forEach(nome => {
    const limpo = String(nome || "").trim();
    const chave = limpo.toLowerCase();
    if (!limpo || vistos.has(chave)) return;
    vistos.add(chave);
    linhas.push({ nome: limpo, ordem: linhas.length + 1 });
  });
  return regravarLista("fichas_equipamentos", fichaId, unidadeId, linhas);
}

export function salvarAlergenicos(fichaId, unidadeId, lista = []) {
  const vistos = new Set();
  const linhas = [];
  lista.forEach(item => {
    const limpo = String(item || "").trim();
    const chave = limpo.toLowerCase();
    if (!limpo || vistos.has(chave)) return;
    vistos.add(chave);
    linhas.push({ alergenico: limpo });
  });
  return regravarLista("fichas_alergenicos", fichaId, unidadeId, linhas);
}

export function salvarMontagemPassos(fichaId, unidadeId, passos = []) {
  const linhas = passos
    .map(p => String(typeof p === "string" ? p : p?.descricao || "").trim())
    .filter(Boolean)
    .map((descricao, i) => ({ ordem: i + 1, descricao }));
  return regravarLista("fichas_montagem_passos", fichaId, unidadeId, linhas);
}

const NUMERO_OU_NULO = v => (v === "" || v == null ? null : Number(v));

export async function salvarArmazenamento(fichaId, unidadeId, dados = {}) {
  if (!isSupabaseReady() || !fichaId) return { error: "Offline" };
  const payload = {
    ficha_id: fichaId,
    unidade_id: unidadeId || null,
    forma: String(dados.forma || "").trim() || null,
    recipiente: String(dados.recipiente || "").trim() || null,
    temperatura_min: NUMERO_OU_NULO(dados.temperatura_min),
    temperatura_max: NUMERO_OU_NULO(dados.temperatura_max),
    validade_refrigerado_dias: NUMERO_OU_NULO(dados.validade_refrigerado_dias),
    validade_congelado_dias: NUMERO_OU_NULO(dados.validade_congelado_dias),
    validade_apos_aberto_dias: NUMERO_OU_NULO(dados.validade_apos_aberto_dias),
    validade_apos_preparo_horas: NUMERO_OU_NULO(dados.validade_apos_preparo_horas),
    local_armazenamento: String(dados.local_armazenamento || "").trim() || null,
    observacoes: String(dados.observacoes || "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("fichas_armazenamento")
    .upsert(payload, { onConflict: "ficha_id" });
  if (error) return { error: estruturaAusente(error) ? "sem_tabela" : erroTexto(error) };
  return { error: null };
}

// ─── Campos da capa da ficha ────────────────────────────────────────────────

// Atualiza SOMENTE colunas de `fichas_tecnicas`, sem encostar em
// `fichas_ingredientes`. Diferente de `salvarFicha` (lib/operacao.js), que
// apaga e regrava a lista de ingredientes inteira — aqui não há motivo para
// esse risco, a tela de detalhe não edita ingredientes.
//
// Se o banco reclamar de uma coluna que a migração ainda não criou, ela é
// removida do payload e a gravação segue, no mesmo espírito do
// `retrySemColunaAusente` de lib/operacao.js.
export async function salvarCamposFicha(fichaId, campos = {}) {
  if (!isSupabaseReady() || !fichaId) return { error: "Offline" };

  const payload = { ...campos };
  delete payload.id;
  delete payload.created_at;
  delete payload.fichas_ingredientes;

  const colunasIgnoradas = [];
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    if (Object.keys(payload).length === 0) break;
    const { error } = await supabase.from("fichas_tecnicas").update(payload).eq("id", fichaId);
    if (!error) {
      return { error: null, colunasIgnoradas };
    }
    const m = error.message || "";
    const achou = m.match(/column "?([a-z_]+)"?(?: of relation "[a-z_]+")? does not exist/i)
      || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
    if (achou && achou[1] in payload) {
      colunasIgnoradas.push(achou[1]);
      delete payload[achou[1]];
      continue;
    }
    return { error: erroTexto(error), colunasIgnoradas };
  }
  return { error: null, colunasIgnoradas };
}

// ─── Código FT-0001 ─────────────────────────────────────────────────────────

// Garante um código para a ficha. Não sobrescreve código já existente.
export async function garantirCodigoFicha(unidadeId, fichaId, codigoAtual) {
  if (String(codigoAtual || "").trim()) return { codigo: codigoAtual, error: null };
  if (!isSupabaseReady() || !fichaId) return { codigo: "", error: null };

  let query = supabase.from("fichas_tecnicas").select("codigo");
  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  const { data, error } = await query;
  if (error) return { codigo: "", error: estruturaAusente(error) ? "sem_tabela" : erroTexto(error) };

  const codigo = proximoCodigoFicha((data || []).map(f => f.codigo).filter(Boolean));
  const { error: erroGravacao } = await supabase
    .from("fichas_tecnicas").update({ codigo }).eq("id", fichaId);
  if (erroGravacao) {
    return { codigo: "", error: estruturaAusente(erroGravacao) ? "sem_tabela" : erroTexto(erroGravacao) };
  }
  return { codigo, error: null };
}

// ─── Duplicar ───────────────────────────────────────────────────────────────

// Cria uma cópia completa da ficha: capa, ingredientes (com as subfichas
// apontando para as MESMAS bases, que continuam compartilhadas) e as seções
// novas. A cópia nasce como rascunho, sem código e na versão 1.0 — código e
// versão pertencem à ficha original.
//
// O histórico de custos e as versões NÃO são copiados: são o passado da
// original, não da cópia.
export async function duplicarFicha(fichaId, { sufixo = "(cópia)" } = {}) {
  if (!isSupabaseReady() || !fichaId) return { error: "Offline" };

  const { data: origem, error } = await supabase
    .from("fichas_tecnicas").select("*").eq("id", fichaId).single();
  if (error) return { error: erroTexto(error) };

  const { id, created_at, updated_at, codigo, versao, atualizado_em, ...campos } = origem;
  campos.nome_receita = `${origem.nome_receita} ${sufixo}`.trim();
  campos.status = "rascunho";

  let insercao = await supabase.from("fichas_tecnicas").insert([campos]).select("id").single();
  // Se o banco recusar uma coluna que a migração ainda não criou, tira e tenta
  // de novo — mesma ideia do retrySemColunaAusente de lib/operacao.js.
  for (let i = 0; insercao.error && i < 30; i++) {
    const m = insercao.error.message || "";
    const achou = m.match(/column "?([a-z_]+)"?(?: of relation "[a-z_]+")? does not exist/i)
      || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
    if (!achou || !(achou[1] in campos)) break;
    delete campos[achou[1]];
    insercao = await supabase.from("fichas_tecnicas").insert([campos]).select("id").single();
  }
  if (insercao.error) return { error: erroTexto(insercao.error) };

  const novoId = insercao.data.id;

  // Ingredientes: as subfichas continuam apontando para as bases originais,
  // que são compartilhadas de propósito — duplicar um prato não deve clonar a
  // maionese da casa.
  const { data: ingredientes } = await supabase
    .from("fichas_ingredientes").select("*").eq("ficha_id", fichaId);
  if (ingredientes?.length) {
    const copias = ingredientes.map(({ id: _i, created_at: _c, updated_at: _u, ...item }) => ({
      ...item, ficha_id: novoId,
    }));
    const r = await supabase.from("fichas_ingredientes").insert(copias);
    if (r.error) {
      // Sem ingredientes a cópia não serve para nada: desfaz para não deixar
      // uma ficha órfã e vazia na listagem.
      await supabase.from("fichas_tecnicas").delete().eq("id", novoId);
      return { error: `Não foi possível copiar os ingredientes: ${r.error.message}` };
    }
  }

  // Seções novas. Se a migração ainda não rodou, simplesmente não há o que
  // copiar — a cópia da ficha continua válida.
  for (const tabela of ["fichas_etapas", "fichas_equipamentos", "fichas_alergenicos",
                        "fichas_montagem_passos"]) {
    const { data: linhas } = await supabase.from(tabela).select("*").eq("ficha_id", fichaId);
    if (linhas?.length) {
      await supabase.from(tabela).insert(
        linhas.map(({ id: _i, created_at: _c, updated_at: _u, ...l }) => ({ ...l, ficha_id: novoId }))
      );
    }
  }
  const { data: armazenamento } = await supabase
    .from("fichas_armazenamento").select("*").eq("ficha_id", fichaId).maybeSingle();
  if (armazenamento) {
    const { id: _i, created_at: _c, updated_at: _u, ...resto } = armazenamento;
    await supabase.from("fichas_armazenamento").insert({ ...resto, ficha_id: novoId });
  }

  return { id: novoId, error: null };
}

// ─── Versionamento ──────────────────────────────────────────────────────────

// Congela o estado atual da ficha como uma versão e sobe o número na ficha.
// Nada é apagado: cada versão é uma linha nova em fichas_versoes.
export async function criarVersaoFicha({
  fichaId, unidadeId, versaoAtual, snapshot = {},
  alteracao = "", usuarioId = null, usuarioNome = "", saltoMaior = false,
}) {
  if (!isSupabaseReady() || !fichaId) return { error: "Offline" };

  const nova = proximaVersao(versaoAtual, saltoMaior);
  const { data, error } = await supabase.from("fichas_versoes").insert({
    unidade_id: unidadeId || null,
    ficha_id: fichaId,
    versao: nova,
    versao_anterior: versaoAtual || null,
    snapshot,
    alteracao: String(alteracao || "").trim() || null,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome || null,
  }).select("*").single();

  if (error) return { error: estruturaAusente(error) ? "sem_tabela" : erroTexto(error) };

  const { error: erroFicha } = await supabase
    .from("fichas_tecnicas")
    .update({ versao: nova, atualizado_em: new Date().toISOString() })
    .eq("id", fichaId);
  if (erroFicha && !estruturaAusente(erroFicha)) return { error: erroTexto(erroFicha) };

  return { data, versao: nova, error: null };
}

// Diferença entre dois retratos, campo a campo, para a tela de comparação.
export function compararVersoes(snapshotA = {}, snapshotB = {}) {
  const chaves = new Set([...Object.keys(snapshotA || {}), ...Object.keys(snapshotB || {})]);
  const diferencas = [];
  for (const chave of chaves) {
    const antes = snapshotA?.[chave];
    const depois = snapshotB?.[chave];
    const mesmo = JSON.stringify(antes ?? null) === JSON.stringify(depois ?? null);
    if (!mesmo) diferencas.push({ campo: chave, antes: antes ?? null, depois: depois ?? null });
  }
  return diferencas.sort((a, b) => a.campo.localeCompare(b.campo));
}

// ─── Salvamento das seções novas em bloco ───────────────────────────────────

// Usado pelo botão SALVAR da ficha: grava tudo que é "das tabelas novas".
// Devolve a lista de seções que não puderam ser gravadas por falta de migração,
// para a tela poder dizer isso ao usuário em vez de mentir que salvou.
export async function salvarComplementosFicha(fichaId, unidadeId, dados = {}) {
  if (!fichaId) return { error: "Ficha sem id", pendentes: [] };

  const resultados = await Promise.all([
    salvarEtapas(fichaId, unidadeId, dados.etapas || []).then(r => ["etapas", r]),
    salvarEquipamentos(fichaId, unidadeId, dados.equipamentos || []).then(r => ["equipamentos", r]),
    salvarAlergenicos(fichaId, unidadeId, dados.alergenicos || []).then(r => ["alergênicos", r]),
    salvarMontagemPassos(fichaId, unidadeId, dados.montagem_passos || []).then(r => ["montagem", r]),
    salvarArmazenamento(fichaId, unidadeId, dados.armazenamento || {}).then(r => ["armazenamento", r]),
  ]);

  const pendentes = resultados.filter(([, r]) => r.error === "sem_tabela").map(([nome]) => nome);
  const falhas = resultados.filter(([, r]) => r.error && r.error !== "sem_tabela");

  return {
    pendentes,
    error: falhas.length ? falhas.map(([nome, r]) => `${nome}: ${r.error}`).join(" · ") : null,
  };
}
