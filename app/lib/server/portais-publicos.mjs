import { createHash, randomBytes } from "node:crypto";
import { normalizarTreinamento } from "../treinamento-normalizar.mjs";

// PORTAIS PÚBLICOS DO RH — o que antes o navegador anônimo fazia direto na
// tabela agora passa por aqui, com service_role só no servidor.
//
//   /extras/[unidade]   → registrarCadastroExtra   (INSERT em extras_cadastros)
//   /vagas/[unidade]    → registrarCandidatura     (INSERT em candidatos)
//                       → lerConviteExtra          (pré-preenchimento, por token)
//   /treinamento/[tok]  → lerTreinamentoPublico    (SELECT em treinamentos)
//
// Regras comuns:
//   - lista fechada de campos (allowlist); campo desconhecido é descartado;
//   - status, nota, colaborador_id e afins NUNCA vêm do cliente;
//   - resposta mínima: nunca a linha gravada.
//
// Módulo sem Next: o banco entra por parâmetro, para dar para testar.

const falha = (status, codigo, mensagem) => ({ ok: false, status, codigo, mensagem });

const texto = (v, max) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");
const unidadeValida = (u) => typeof u === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(u);
const dataValida = (v) => {
  if (!v) return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return undefined;
  const ano = d.getUTCFullYear();
  if (ano < 1920 || ano > new Date().getUTCFullYear() - 13) return undefined;
  return s;
};
const horaValida = (v) => (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : null);

/** Objeto de respostas: chaves simples, valores curtos, tamanho limitado. */
function respostasLimpas(obj, { maxChaves = 30, maxValor = 300 } = {}) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const saida = {};
  for (const [k, v] of Object.entries(obj).slice(0, maxChaves)) {
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(k)) continue;
    if (v == null) continue;
    if (typeof v === "object") {
      // Respostas de múltipla escolha às vezes chegam como { texto } ou { indice }.
      const t = texto(v.texto, maxValor);
      if (t) saida[k] = { texto: t };
      else if (Number.isInteger(v.indice) && v.indice >= 0 && v.indice < 50) saida[k] = { indice: v.indice };
      continue;
    }
    const t = texto(v, maxValor);
    if (t) saida[k] = t;
  }
  return saida;
}

async function unidadeExiste(db, unidade) {
  const { data, error } = await db.from("unidades").select("id").eq("id", unidade).maybeSingle();
  if (error) throw new Error("leitura_unidade");
  return Boolean(data?.id);
}

// Coluna ainda não migrada? Tira do envio e tenta de novo — mesmo critério do
// portal antigo: o candidato não pode ver erro por ALTER TABLE pendente.
async function inserirTolerante(db, tabela, payload, { tentativas = 6 } = {}) {
  const campos = { ...payload };
  for (let n = 0; n <= tentativas; n += 1) {
    const { data, error } = await db.from(tabela).insert([campos]).select("id").single();
    if (!error) return { id: data?.id ?? null };
    const m = error.message || "";
    const achou = m.match(/column "?([a-z_]+)"? (?:of relation "[a-z_]+" )?does not exist/i)
      || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
    if (!achou || !(achou[1] in campos) || achou[1] === "unidade_id") return { erro: true };
    delete campos[achou[1]];
  }
  return { erro: true };
}

// ─── EXTRAS ──────────────────────────────────────────────────────────────────

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const INTERESSES = ["extra", "clt", "ambos"];

/** Valida e monta o payload do cadastro de extra. Só campos conhecidos. */
export function validarCadastroExtra(unidade, form, respostas) {
  if (!unidadeValida(unidade)) return falha(400, "unidade_invalida", "Link inválido.");
  const f = form && typeof form === "object" ? form : {};

  const nome = texto(f.nome, 120);
  if (!nome || nome.length < 3) return falha(400, "parametro_invalido", "Informe seu nome completo.");
  const tel = soDigitos(f.telefone);
  if (tel.length < 10 || tel.length > 13) return falha(400, "parametro_invalido", "Informe um telefone com DDD.");
  const funcao = texto(f.funcao_principal, 60);
  if (!funcao) return falha(400, "parametro_invalido", "Escolha sua função principal.");
  const dias = Array.isArray(f.dias_disponiveis) ? [...new Set(f.dias_disponiveis.filter((d) => DIAS.includes(d)))] : [];
  if (!dias.length) return falha(400, "parametro_invalido", "Marque pelo menos um dia disponível.");
  const nascimento = dataValida(f.data_nascimento);
  if (nascimento === undefined) return falha(400, "parametro_invalido", "Data de nascimento inválida.");
  const temFilhos = f.tem_filhos === true;
  const qtd = Number(f.qtd_filhos);

  return {
    ok: true,
    payload: {
      unidade_id: unidade,
      nome,
      telefone: texto(f.telefone, 20),
      data_nascimento: nascimento,
      nacionalidade: texto(f.nacionalidade, 40),
      estado_civil: texto(f.estado_civil, 40),
      genero: texto(f.genero, 40),
      escolaridade: texto(f.escolaridade, 60),
      tem_filhos: temFilhos,
      qtd_filhos: temFilhos ? (Number.isInteger(qtd) && qtd >= 0 && qtd <= 20 ? qtd : 0) : null,
      endereco: texto(f.endereco, 160),
      numero: texto(f.numero, 20),
      bairro: texto(f.bairro, 80),
      cidade: texto(f.cidade, 80),
      funcao_principal: funcao,
      funcao_secundaria: texto(f.funcao_secundaria, 60),
      dias_disponiveis: dias,
      hora_inicio: horaValida(f.hora_inicio),
      hora_fim: horaValida(f.hora_fim),
      experiencia: texto(f.experiencia, 2000),
      interesse: INTERESSES.includes(f.interesse) ? f.interesse : "extra",
      respostas: respostasLimpas(respostas),
      observacoes: texto(f.observacoes, 2000),
    },
  };
}

export const CONVITE_MINUTOS = 30;
export const CONVITE_USOS = 3;

export const hashDoToken = (token) => createHash("sha256").update(String(token)).digest("hex");
export const novoTokenDeConvite = () => randomBytes(32).toString("base64url");
const tokenDeConviteValido = (t) => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);

/**
 * Grava o cadastro. Devolve { ok, convite } — convite só para quem quer vaga
 * CLT, e só se a tabela de convites existir. Nunca devolve o id do cadastro.
 */
export async function registrarCadastroExtra({ db, payload, agora = Date.now(), limitePorTelefone = 3 }) {
  try {
    if (!(await unidadeExiste(db, payload.unidade_id))) return falha(404, "unidade_invalida", "Link inválido.");

    // Mesmo telefone repetindo em sequência: freio simples contra robô.
    const desde = new Date(agora - 10 * 60 * 1000).toISOString();
    const { count, error: eConta } = await db.from("extras_cadastros")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", payload.unidade_id).eq("telefone", payload.telefone).gte("created_at", desde);
    if (!eConta && (count || 0) >= limitePorTelefone) {
      return falha(429, "limite", "Recebemos vários envios seguidos. Tente de novo em alguns minutos.");
    }

    const r = await inserirTolerante(db, "extras_cadastros", payload);
    if (r.erro || !r.id) return falha(503, "indisponivel", "Não foi possível enviar agora.");

    let convite = null;
    if (payload.interesse === "clt" || payload.interesse === "ambos") {
      const token = novoTokenDeConvite();
      const { error } = await db.from("extras_convites").insert([{
        token_hash: hashDoToken(token),
        extras_cadastro_id: r.id,
        escopo: "vaga_prefill",
        expira_em: new Date(agora + CONVITE_MINUTOS * 60 * 1000).toISOString(),
        usos_restantes: CONVITE_USOS,
      }]);
      // Sem a tabela (migração pendente) o cadastro vale do mesmo jeito; só
      // não há pré-preenchimento.
      if (!error) convite = token;
    }
    return { ok: true, convite };
  } catch {
    return falha(503, "indisponivel", "Não foi possível enviar agora.");
  }
}

/** Campos que o portal de vagas pré-preenche — e mais nenhum. */
const CAMPOS_PREFILL = ["nome", "telefone", "data_nascimento", "endereco", "bairro", "cidade",
  "escolaridade", "tem_filhos", "experiencia", "funcao_principal"];

/**
 * Troca um convite válido pelos dados que o próprio candidato digitou.
 * Todas as recusas têm a mesma resposta: quem sonda não aprende nada.
 */
export async function lerConviteExtra({ db, token, agora = Date.now() }) {
  const invalido = falha(404, "convite_invalido", "Convite inválido ou expirado.");
  if (!tokenDeConviteValido(token)) return invalido;
  try {
    const { data: convite, error } = await db.from("extras_convites")
      .select("id, extras_cadastro_id, escopo, expira_em, usos_restantes, revogado_em")
      .eq("token_hash", hashDoToken(token)).maybeSingle();
    if (error || !convite) return invalido;
    if (convite.revogado_em || convite.escopo !== "vaga_prefill") return invalido;
    if (!convite.expira_em || new Date(convite.expira_em).getTime() <= agora) return invalido;
    const usos = Number(convite.usos_restantes);
    if (!(usos > 0)) return invalido;

    // Gasta um uso só se ninguém gastou no meio do caminho.
    const { data: gasto, error: eUso } = await db.from("extras_convites")
      .update({ usos_restantes: usos - 1, ultimo_uso_em: new Date(agora).toISOString() })
      .eq("id", convite.id).eq("usos_restantes", usos).select("id");
    if (eUso || !gasto?.length) return invalido;

    const { data: cad, error: eCad } = await db.from("extras_cadastros")
      .select(CAMPOS_PREFILL.join(", ")).eq("id", convite.extras_cadastro_id).maybeSingle();
    if (eCad || !cad) return invalido;
    const dados = {};
    for (const c of CAMPOS_PREFILL) if (cad[c] !== undefined) dados[c] = cad[c];
    return { ok: true, dados };
  } catch {
    return invalido;
  }
}

// ─── CANDIDATURA (portal de vagas) ───────────────────────────────────────────

/**
 * Valida a candidatura. A nota do teste de perfil é calculada AQUI, pelo
 * servidor (gerarLaudo), e o status é sempre "Novo": nada disso vem do
 * navegador, onde o candidato conseguiria escolher a própria nota.
 */
export function validarCandidatura(unidade, dados, respostas, { gerarLaudo }) {
  if (!unidadeValida(unidade)) return falha(400, "unidade_invalida", "Link inválido.");
  const d = dados && typeof dados === "object" ? dados : {};
  const nome = texto(d.nome, 120);
  if (!nome || nome.length < 3) return falha(400, "parametro_invalido", "Informe seu nome completo.");
  const tel = soDigitos(d.telefone);
  if (tel.length < 10 || tel.length > 13) return falha(400, "parametro_invalido", "Informe um telefone com DDD.");
  const cpfDigitos = soDigitos(d.cpf);
  if (d.cpf != null && d.cpf !== "" && cpfDigitos.length !== 11) return falha(400, "parametro_invalido", "CPF inválido.");

  const det = d.detalhesCadastro && typeof d.detalhesCadastro === "object" ? d.detalhesCadastro : {};
  const nascimento = dataValida(det.nascimento);
  if (nascimento === undefined) return falha(400, "parametro_invalido", "Data de nascimento inválida.");
  const detalhes = {
    nome, telefone: texto(det.telefone, 20), nascimento,
    endereco: texto(det.endereco, 160), bairro: texto(det.bairro, 80), cidade: texto(det.cidade, 80),
    enderecoCompleto: texto(det.enderecoCompleto, 320), cargoPretendido: texto(det.cargoPretendido, 80),
    temFilhos: texto(det.temFilhos, 10), temTransporte: texto(det.temTransporte, 40),
    escolaridade: texto(det.escolaridade, 60), experiencia: texto(det.experiencia, 3000),
    origem: "Portal público de vagas",
  };

  const resp = respostasLimpas(respostas);
  const { nota_ia, avaliacao_ia } = gerarLaudo(resp);
  return {
    ok: true,
    payload: {
      unidade_id: unidade,
      nome,
      cpf: cpfDigitos.length === 11 ? cpfDigitos : null,
      telefone: texto(d.telefone, 20),
      endereco: texto(d.endereco, 320),
      cargo_pretendido: texto(d.cargoPretendido, 80),
      tem_filhos: texto(d.temFilhos, 10),
      experiencia: texto(d.experiencia, 3000),
      respostas_comportamentais: { ...resp, _dados_pessoais: detalhes, _versao_formulario: 2 },
      url_curriculo: null,
      avaliacao_ia,
      nota_ia,
      status: "Novo",
    },
  };
}

export async function registrarCandidatura({ db, payload, agora = Date.now(), limitePorTelefone = 3 }) {
  try {
    if (!(await unidadeExiste(db, payload.unidade_id))) return falha(404, "unidade_invalida", "Link inválido.");
    const desde = new Date(agora - 10 * 60 * 1000).toISOString();
    const { count, error: eConta } = await db.from("candidatos")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", payload.unidade_id).eq("telefone", payload.telefone).gte("created_at", desde);
    if (!eConta && (count || 0) >= limitePorTelefone) {
      return falha(429, "limite", "Recebemos várias inscrições seguidas. Tente de novo em alguns minutos.");
    }
    const r = await inserirTolerante(db, "candidatos", payload);
    if (r.erro) return falha(503, "indisponivel", "Não foi possível enviar agora.");
    return { ok: true };
  } catch {
    return falha(503, "indisponivel", "Não foi possível enviar agora.");
  }
}

// ─── TREINAMENTO PÚBLICO ─────────────────────────────────────────────────────

const tokenDeTreinamentoValido = (t) => typeof t === "string" && /^[a-f0-9]{64}$/.test(t);

/** Só o que a página pública mostra. Unidade, autor, datas e ids ficam de fora. */
const CAMPOS_PUBLICOS_TREINAMENTO = ["titulo", "descricao", "departamento", "modulo",
  "duracao_minutos", "obrigatorio", "conteudo_texto", "link_video"];

export async function lerTreinamentoPublico({ db, token }) {
  const naoEncontrado = falha(404, "nao_encontrado", "Treinamento não encontrado.");
  if (!tokenDeTreinamentoValido(token)) return naoEncontrado;
  try {
    // select("*") só aqui dentro: o normalizador precisa da descrição com o
    // bloco de metadados, e o que SAI é filtrado logo abaixo.
    const { data, error } = await db.from("treinamentos").select("*").eq("token_publico", token).maybeSingle();
    if (error) return falha(503, "indisponivel", "Treinamento indisponível no momento.");
    if (!data) return naoEncontrado;
    const item = normalizarTreinamento(data);
    const publico = {};
    for (const c of CAMPOS_PUBLICOS_TREINAMENTO) publico[c] = item[c] ?? null;
    return { ok: true, treinamento: publico };
  } catch {
    return falha(503, "indisponivel", "Treinamento indisponível no momento.");
  }
}
