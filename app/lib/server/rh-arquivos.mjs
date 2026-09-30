import { randomUUID } from "node:crypto";
import { lerRef, montarRef, ehLinkExterno } from "../storage-ref.mjs";
import { verificarAcessoAUnidade } from "./autorizacao-unidade.mjs";
import { permite } from "./permissoes-efetivas.mjs";

// ARQUIVOS DE RH — quem pode abrir, enviar e apagar, decidido no servidor.
//
// O cliente NUNCA manda caminho de arquivo nem unidade para ler. Manda
// { fonte, id }: "o anexo do atestado 123". O servidor:
//   1. carrega o registro com service_role;
//   2. descobre a unidade PELO BANCO (do colaborador/funcionário dono, ou do
//      próprio registro) — nunca pela URL, nome de arquivo ou corpo do pedido;
//   3. confere vínculo do usuário com a unidade e a permissão de RH;
//   4. confere que o arquivo gravado pertence mesmo àquele dono (um registro
//      da unidade A não pode apontar para o arquivo da unidade B);
//   5. só então gera uma URL assinada curta.
//
// Arquivo novo vai para o bucket privado `rh-docs`, em
//   <unidade>/<categoria>/<dono>/<uuid>.<ext>
// e o banco guarda storage://rh-docs/<esse caminho> — nunca URL.

export const BUCKET_RH = "rh-docs";

export const TTL_PADRAO = 120;
const TTL_MIN = 30;
const TTL_MAX = 600;

/** Prazo da URL assinada, em segundos. Configurável, mas sempre curto. */
export function ttlDaUrl(env = process.env) {
  const n = Number(env?.RH_ARQUIVO_URL_TTL_SEGUNDOS);
  if (!Number.isFinite(n) || n <= 0) return TTL_PADRAO;
  return Math.min(TTL_MAX, Math.max(TTL_MIN, Math.round(n)));
}

const LER_RH = ["rh.employees.view", "rh.overview.view"];
const ESCREVER_RH = ["rh.employees.create", "rh.employees.edit"];
const APAGAR_RH = ["rh.employees.delete", "rh.employees.edit"];

const EXT_DOC = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "doc", "docx"];
const EXT_FOTO = ["jpg", "jpeg", "png", "webp", "heic"];
const MB = 1024 * 1024;

// dono:
//   "colaborador" — a unidade é a do colaborador em colunaDono
//   "funcionario" — a unidade é a do funcionário (cadastro legado) em colunaDono
//   "registro"    — a unidade é a coluna unidade_id do próprio registro
//
// legado: como o arquivo era gravado ANTES desta fase. Só é aceito se o
// caminho bater com o dono que o banco diz — ou, onde o caminho antigo não
// carregava dono nenhum (fotos/), se estiver na pasta exata daquela fonte.
export const FONTES = Object.freeze({
  documento: {
    tabela: "documentos_rh", coluna: "url_arquivo", dono: "colaborador", colunaDono: "colaborador_id",
    categoria: "documentos", extensoes: EXT_DOC, maxBytes: 15 * MB,
    ler: LER_RH, escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: BUCKET_RH, aceita: (p, d) => p.startsWith(`${d.donoId}/`) }],
  },
  atestado: {
    tabela: "rh_atestados", coluna: "arquivo_url", dono: "colaborador", colunaDono: "colaborador_id",
    categoria: "atestados", extensoes: EXT_DOC, maxBytes: 15 * MB,
    ler: LER_RH, escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: BUCKET_RH, aceita: (p, d) => p.startsWith(`atestados/${d.donoId}/`) }],
  },
  regulamento: {
    tabela: "rh_regulamentos", coluna: "url_pdf", dono: "registro",
    categoria: "regulamento", extensoes: ["pdf", "doc", "docx"], maxBytes: 20 * MB,
    // O contrato do colaborador mostra o regulamento: quem vê o portal lê.
    ler: [...LER_RH, "rh.employee_portal.view"], escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: BUCKET_RH, aceita: (p, d) => !p.includes("/") && p.startsWith(`regulamento-${d.unidadeId}-`) }],
  },
  foto_funcionario: {
    tabela: "funcionarios", coluna: "foto_url", dono: "registro",
    categoria: "fotos", extensoes: EXT_FOTO, maxBytes: 8 * MB,
    ler: [...LER_RH, "rh.orgchart.view"], escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: "anexos", aceita: (p) => p.startsWith("fotos/") }],
  },
  foto_colaborador: {
    tabela: "colaboradores", coluna: "foto_url", dono: "registro",
    categoria: "fotos", extensoes: EXT_FOTO, maxBytes: 8 * MB,
    ler: [...LER_RH, "rh.orgchart.view"], escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: "anexos", aceita: (p) => p.startsWith("fotos/") }],
  },
  // Abas do cadastro legado (/dashboard/rh/funcionario/[id]).
  holerite: {
    tabela: "holerites", coluna: "arquivo_url", dono: "funcionario", colunaDono: "func_id",
    categoria: "holerites", extensoes: EXT_DOC, maxBytes: 15 * MB,
    ler: ["rh.payroll.view", ...LER_RH], escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: "anexos", aceita: (p, d) => p.startsWith(`holerites/${d.donoId}/`) }],
  },
  documento_funcionario: {
    tabela: "func_documentos", coluna: "arquivo_url", dono: "funcionario", colunaDono: "func_id",
    categoria: "documentos", extensoes: EXT_DOC, maxBytes: 15 * MB,
    ler: LER_RH, escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: "anexos", aceita: (p, d) => p.startsWith(`documentos/${d.donoId}/`) }],
  },
  curso: {
    tabela: "cursos", coluna: "arquivo_url", dono: "funcionario", colunaDono: "func_id",
    categoria: "cursos", extensoes: EXT_DOC, maxBytes: 15 * MB,
    ler: LER_RH, escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: "anexos", aceita: (p, d) => p.startsWith(`cursos/${d.donoId}/`) }],
  },
  ata_funcionario: {
    tabela: "rh_atas", coluna: "arquivo_url", dono: "funcionario", colunaDono: "func_id",
    categoria: "atas", extensoes: EXT_DOC, maxBytes: 15 * MB,
    ler: ["rh.minutes.view", ...LER_RH], escrever: ESCREVER_RH, apagar: APAGAR_RH,
    legado: [{ bucket: "anexos", aceita: (p, d) => p.startsWith(`atas/${d.donoId}/`) }],
  },
});

export const ERRO = Object.freeze({
  FONTE: "fonte_invalida",
  PARAMETRO: "parametro_invalido",
  NAO_ENCONTRADO: "nao_encontrado",
  SEM_ARQUIVO: "sem_arquivo",
  SEM_PERMISSAO: "sem_permissao",
  INCONSISTENTE: "referencia_inconsistente",
  ARQUIVO: "arquivo_recusado",
  INDISPONIVEL: "indisponivel",
});

// Regulamento é da unidade, não de um registro: o "dono" no caminho é a
// própria unidade. Os demais registros com unidade própria usam o id.
const donoIdDoRegistro = (fonte, unidadeId, registroId) =>
  fonte.categoria === "regulamento" ? String(unidadeId) : String(registroId);

const falha = (status, codigo, mensagem) => ({ ok: false, status, codigo, mensagem });
const idValido = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v)
  || (typeof v === "number" && Number.isSafeInteger(v) && v > 0);

/**
 * De quem é este registro? Devolve { unidadeId, donoId } lidos do banco.
 * Se o registro tiver unidade própria E dono com outra unidade, é
 * inconsistente e ninguém abre — melhor negar do que escolher uma.
 */
async function donoDoRegistro(db, fonte, registro) {
  const unidadeDoRegistro = registro.unidade_id != null ? String(registro.unidade_id) : null;
  if (fonte.dono === "registro") {
    return unidadeDoRegistro
      ? { unidadeId: unidadeDoRegistro, donoId: donoIdDoRegistro(fonte, unidadeDoRegistro, registro.id) }
      : null;
  }
  const donoId = registro[fonte.colunaDono];
  if (donoId == null || donoId === "") return null;
  const tabelaDono = fonte.dono === "colaborador" ? "colaboradores" : "funcionarios";
  const { data: dono, error } = await db.from(tabelaDono).select("id, unidade_id").eq("id", donoId).maybeSingle();
  if (error) throw new Error("leitura_dono");
  if (!dono?.unidade_id) return null;
  const unidadeDoDono = String(dono.unidade_id);
  if (unidadeDoRegistro && unidadeDoRegistro !== unidadeDoDono) return { inconsistente: true };
  return { unidadeId: unidadeDoDono, donoId: String(donoId) };
}

/** O arquivo gravado pertence mesmo a este dono? */
export function arquivoPertence(fonte, ref, dono) {
  if (!ref) return false;
  if (ref.bucket === BUCKET_RH && ref.formato === "ref") {
    const [unidade, categoria, donoDoCaminho] = ref.path.split("/");
    if (unidade !== dono.unidadeId || categoria !== fonte.categoria) return false;
    // Foto de funcionário/colaborador enviada antes do cadastro existir leva
    // "novo" no lugar do id; a unidade continua conferida.
    if (fonte.dono === "registro" && fonte.categoria === "fotos") {
      return donoDoCaminho === dono.donoId || donoDoCaminho === "novo";
    }
    return donoDoCaminho === dono.donoId;
  }
  return fonte.legado.some((l) => l.bucket === ref.bucket && l.aceita(ref.path, dono));
}

async function carregarRegistro(db, fonte, id) {
  const colunas = ["id", fonte.coluna, fonte.colunaDono].filter(Boolean);
  // unidade_id nem sempre existe: pede junto e, se a coluna faltar, pede sem.
  let r = await db.from(fonte.tabela).select([...colunas, "unidade_id"].join(", ")).eq("id", id).maybeSingle();
  if (r.error && /unidade_id/i.test(r.error.message || "")) {
    r = await db.from(fonte.tabela).select(colunas.join(", ")).eq("id", id).maybeSingle();
  }
  if (r.error) throw new Error("leitura_registro");
  return r.data;
}

/**
 * Autoriza a leitura de UM arquivo e, se tudo bater, assina.
 * @returns {Promise<{ok:true,url:string,expiraEm:string,externo?:boolean}|{ok:false,status:number,codigo:string,mensagem:string}>}
 */
export async function assinarUmArquivo({ db, usuario, perms, fonteId, id, ttl = TTL_PADRAO, hostEsperado, agora = Date.now() }) {
  const fonte = FONTES[fonteId];
  if (!fonte) return falha(400, ERRO.FONTE, "Tipo de arquivo desconhecido.");
  if (!idValido(id)) return falha(400, ERRO.PARAMETRO, "Identificador inválido.");

  let registro;
  let dono;
  try {
    registro = await carregarRegistro(db, fonte, id);
    if (!registro) return falha(404, ERRO.NAO_ENCONTRADO, "Registro não encontrado.");
    dono = await donoDoRegistro(db, fonte, registro);
  } catch {
    return falha(503, ERRO.INDISPONIVEL, "Não foi possível verificar o arquivo agora.");
  }
  // Sem dono identificável não há como autorizar: mesma resposta de
  // "não encontrado", para não confirmar que o registro existe.
  if (!dono) return falha(404, ERRO.NAO_ENCONTRADO, "Registro não encontrado.");
  if (dono.inconsistente) return falha(403, ERRO.INCONSISTENTE, "Registro com unidade inconsistente.");

  const acesso = await verificarAcessoAUnidade(db, usuario, dono.unidadeId);
  if (acesso.erro) return falha(acesso.erro.status, acesso.erro.codigo, acesso.erro.mensagem);
  if (!permite(perms, fonte.ler)) return falha(403, ERRO.SEM_PERMISSAO, "Você não tem permissão para ver arquivos de RH.");

  const valor = registro[fonte.coluna];
  if (!valor) return falha(404, ERRO.SEM_ARQUIVO, "Este registro não tem arquivo.");

  // Link externo digitado pelo usuário (Drive etc.): não é arquivo nosso, não
  // há o que assinar. Só sai para quem já passou pela autorização acima.
  if (ehLinkExterno(valor, { hostEsperado })) {
    return { ok: true, url: String(valor).trim(), externo: true, expiraEm: null };
  }

  const ref = lerRef(valor, { hostEsperado });
  if (!ref) return falha(404, ERRO.SEM_ARQUIVO, "Arquivo em formato não reconhecido.");
  if (!arquivoPertence(fonte, ref, dono)) {
    return falha(403, ERRO.INCONSISTENTE, "O arquivo gravado não pertence a este registro.");
  }

  const { data, error } = await db.storage.from(ref.bucket).createSignedUrl(ref.path, ttl);
  if (error || !data?.signedUrl) return falha(404, ERRO.SEM_ARQUIVO, "Arquivo não encontrado no armazenamento.");
  return { ok: true, url: data.signedUrl, expiraEm: new Date(agora + ttl * 1000).toISOString() };
}

const LIMITE_LOTE = 60;

/** Vários de uma vez (listas com foto). Cada item é autorizado sozinho. */
export async function assinarArquivos({ db, usuario, perms, itens, ttl, hostEsperado }) {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > LIMITE_LOTE) {
    return falha(400, ERRO.PARAMETRO, `Envie de 1 a ${LIMITE_LOTE} itens.`);
  }
  const resultados = [];
  for (const item of itens) {
    const r = await assinarUmArquivo({ db, usuario, perms, fonteId: item?.fonte, id: item?.id, ttl, hostEsperado });
    resultados.push({ fonte: item?.fonte ?? null, id: item?.id ?? null, ...r });
  }
  return { ok: true, itens: resultados };
}

const extensaoDe = (nome) => {
  const m = String(nome || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : "";
};

/**
 * Prepara o envio de um arquivo: autoriza, escolhe o caminho (o cliente não
 * escolhe) e devolve um token de upload assinado para o bucket privado.
 *
 * @param {object} p
 * @param {string} p.fonteId
 * @param {string|null} p.donoId       colaborador/funcionário/registro dono; null = "novo"
 * @param {string|null} p.unidadeId    só para fonte "registro" sem registro ainda
 */
export async function prepararEnvio({ db, usuario, perms, fonteId, donoId, unidadeId, nomeArquivo, tamanho }) {
  const fonte = FONTES[fonteId];
  if (!fonte) return falha(400, ERRO.FONTE, "Tipo de arquivo desconhecido.");

  const ext = extensaoDe(nomeArquivo);
  if (!fonte.extensoes.includes(ext)) {
    return falha(400, ERRO.ARQUIVO, `Formato não aceito. Use: ${fonte.extensoes.join(", ")}.`);
  }
  const bytes = Number(tamanho);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > fonte.maxBytes) {
    return falha(400, ERRO.ARQUIVO, `Arquivo acima de ${Math.round(fonte.maxBytes / MB)} MB.`);
  }

  let dono;
  try {
    if (fonte.dono === "registro") {
      if (donoId != null && donoId !== "") {
        if (!idValido(donoId)) return falha(400, ERRO.PARAMETRO, "Identificador inválido.");
        const { data, error } = await db.from(fonte.tabela).select("id, unidade_id").eq("id", donoId).maybeSingle();
        if (error) throw new Error("leitura");
        if (!data?.unidade_id) return falha(404, ERRO.NAO_ENCONTRADO, "Registro não encontrado.");
        if (unidadeId && String(unidadeId) !== String(data.unidade_id)) {
          return falha(403, ERRO.INCONSISTENTE, "Registro de outra unidade.");
        }
        dono = { unidadeId: String(data.unidade_id), donoId: donoIdDoRegistro(fonte, data.unidade_id, data.id) };
      } else if (fonte.categoria === "regulamento") {
        dono = { unidadeId: String(unidadeId || ""), donoId: String(unidadeId || "") };
      } else {
        dono = { unidadeId: String(unidadeId || ""), donoId: "novo" };
      }
    } else {
      if (!idValido(donoId)) return falha(400, ERRO.PARAMETRO, "Informe o colaborador.");
      const tabelaDono = fonte.dono === "colaborador" ? "colaboradores" : "funcionarios";
      const { data, error } = await db.from(tabelaDono).select("id, unidade_id").eq("id", donoId).maybeSingle();
      if (error) throw new Error("leitura");
      if (!data?.unidade_id) return falha(404, ERRO.NAO_ENCONTRADO, "Colaborador não encontrado.");
      dono = { unidadeId: String(data.unidade_id), donoId: String(data.id) };
    }
  } catch {
    return falha(503, ERRO.INDISPONIVEL, "Não foi possível verificar o destino agora.");
  }

  const acesso = await verificarAcessoAUnidade(db, usuario, dono.unidadeId);
  if (acesso.erro) return falha(acesso.erro.status, acesso.erro.codigo, acesso.erro.mensagem);
  if (!permite(perms, fonte.escrever)) return falha(403, ERRO.SEM_PERMISSAO, "Você não tem permissão para enviar arquivos de RH.");

  const path = `${dono.unidadeId}/${fonte.categoria}/${dono.donoId}/${randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from(BUCKET_RH).createSignedUploadUrl(path);
  if (error || !data?.token) return falha(503, ERRO.INDISPONIVEL, "Armazenamento indisponível.");
  return { ok: true, bucket: BUCKET_RH, path, token: data.token, ref: montarRef(BUCKET_RH, path) };
}

/** Apaga o objeto do Storage de um registro (o registro em si o cliente apaga). */
export async function removerArquivo({ db, usuario, perms, fonteId, id, hostEsperado }) {
  const fonte = FONTES[fonteId];
  if (!fonte) return falha(400, ERRO.FONTE, "Tipo de arquivo desconhecido.");
  if (!idValido(id)) return falha(400, ERRO.PARAMETRO, "Identificador inválido.");
  let registro;
  let dono;
  try {
    registro = await carregarRegistro(db, fonte, id);
    if (!registro) return falha(404, ERRO.NAO_ENCONTRADO, "Registro não encontrado.");
    dono = await donoDoRegistro(db, fonte, registro);
  } catch {
    return falha(503, ERRO.INDISPONIVEL, "Não foi possível verificar o arquivo agora.");
  }
  if (!dono) return falha(404, ERRO.NAO_ENCONTRADO, "Registro não encontrado.");
  if (dono.inconsistente) return falha(403, ERRO.INCONSISTENTE, "Registro com unidade inconsistente.");

  const acesso = await verificarAcessoAUnidade(db, usuario, dono.unidadeId);
  if (acesso.erro) return falha(acesso.erro.status, acesso.erro.codigo, acesso.erro.mensagem);
  if (!permite(perms, fonte.apagar)) return falha(403, ERRO.SEM_PERMISSAO, "Você não tem permissão para apagar arquivos de RH.");

  const ref = lerRef(registro[fonte.coluna], { hostEsperado });
  // Sem arquivo nosso não há o que apagar — e não é erro.
  if (!ref) return { ok: true, removido: false };
  if (!arquivoPertence(fonte, ref, dono)) {
    return falha(403, ERRO.INCONSISTENTE, "O arquivo gravado não pertence a este registro.");
  }
  const { error } = await db.storage.from(ref.bucket).remove([ref.path]);
  if (error) return falha(503, ERRO.INDISPONIVEL, "Não foi possível apagar o arquivo agora.");
  return { ok: true, removido: true };
}
