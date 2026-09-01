import { supabase, isSupabaseReady } from "./supabase";
import { comprimirFoto } from "./operacao-evidencias";

export async function fetchTemplates(unidadeId, dept, tipo) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  
  let query = supabase.from("checklists_templates").select("*").eq("ativo", true);
  
  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function salvarTemplate(template) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  // `id` nulo quebra o INSERT (coluna id NOT NULL com default no Postgres)
  const { id, created_at, ...campos } = template;

  if (id) {
    const { error } = await supabase.from("checklists_templates").update(campos).eq("id", id);
    return { error: error?.message };
  } else {
    const { error } = await supabase.from("checklists_templates").insert([campos]);
    return { error: error?.message };
  }
}

export async function desativarTemplate(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("checklists_templates").update({ ativo: false }).eq("id", id);
  return { error: error?.message };
}

// ─── EXECUÇÃO (Operacional) ──────────────────────────────────────────────────

export async function salvarExecucao(execucao) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("checklists_execucoes").insert([execucao]);
  return { error: error?.message };
}

// Todas as execuções de um mês (para o relatório imprimível)
export async function fetchExecucoesMes(unidadeId, mesAno, dept) {
  if (!isSupabaseReady()) return { data: [] };
  const [ano, mes] = String(mesAno).split("-").map(Number);
  const inicio = `${mesAno}-01`;
  const fim = new Date(ano, mes, 1).toISOString().split("T")[0]; // 1º dia do mês seguinte
  let query = supabase.from("checklists_execucoes")
    .select(`*, checklists_templates!inner(titulo, departamento, tipo), colaboradores(nome)`)
    .gte("data_referencia", inicio)
    .lt("data_referencia", fim)
    .order("data_referencia", { ascending: true });
  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("checklists_templates.departamento", dept);
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

// Execuções em um intervalo [inicio, fim) — para produtividade por dia/mês/ano
export async function fetchExecucoesIntervalo(unidadeId, inicio, fim, dept) {
  if (!isSupabaseReady()) return { data: [] };
  let query = supabase.from("checklists_execucoes")
    .select(`*, checklists_templates!inner(titulo, departamento, tipo), colaboradores(nome)`)
    .gte("data_referencia", inicio)
    .lt("data_referencia", fim)
    .order("data_referencia", { ascending: true });
  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("checklists_templates.departamento", dept);
  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

export async function fetchHistoricoExecucoes(unidadeId, dataRef, dept) {
  if (!isSupabaseReady()) return { data: [] };
  
  // Faz um join com a tabela de templates para trazer o nome e o departamento
  let query = supabase.from("checklists_execucoes")
    .select(`
      *,
      checklists_templates!inner(titulo, departamento, tipo),
      colaboradores(nome)
    `)
    .eq("data_referencia", dataRef);

  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("checklists_templates.departamento", dept);

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

// ─── FOTO DE REFERÊNCIA ──────────────────────────────────────────────────────
//
// "Como o ambiente tem que ficar." Não é evidência do que foi feito (isso é
// op_evidencias, outro módulo): é o padrão, tirado uma vez pelo gestor e
// olhado por quem executa. Por isso mora no template, não na execução.
//
// Vai para o bucket "anexos", o mesmo das evidências, e o que fica guardado
// no item é só a URL — o JSONB do template não aguentaria a imagem embutida.


const BUCKET_CHECKLIST = "anexos";
const PASTA_CHECKLIST = "checklists/referencias";

export async function salvarFotoReferencia(file, { unidadeId, itemId } = {}) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  if (!file) return { error: "Escolha uma foto." };

  let foto;
  try {
    foto = await comprimirFoto(file);
  } catch (e) {
    return { error: e?.message || "Não consegui preparar a foto." };
  }

  const caminho = `${PASTA_CHECKLIST}/${unidadeId || "sem-unidade"}/${itemId || "item"}-${Date.now()}.jpg`;
  const envio = await supabase.storage.from(BUCKET_CHECKLIST)
    .upload(caminho, foto.blob, { contentType: foto.mediaType, upsert: false });
  if (envio.error) return { error: `Não consegui enviar a foto: ${envio.error.message}` };

  const url = supabase.storage.from(BUCKET_CHECKLIST).getPublicUrl(caminho).data?.publicUrl || null;
  if (!url) return { error: "A foto subiu mas o endereço dela não voltou. Tente de novo." };
  return { url, error: null };
}

// Soma dos minutos das tarefas. Tarefa sem tempo não vira zero à força: ela
// simplesmente não entra, e o total avisa que é parcial — dizer "1h30" quando
// metade das tarefas não tem tempo seria pior do que dizer que falta.
export function tempoDoChecklist(itens = []) {
  let minutos = 0;
  let comTempo = 0;
  for (const item of itens || []) {
    const n = Number(item?.minutos);
    if (Number.isFinite(n) && n > 0) { minutos += n; comTempo += 1; }
  }
  const total = (itens || []).length;
  return { minutos, comTempo, total, parcial: comTempo > 0 && comTempo < total };
}

export function formatarMinutos(minutos) {
  const n = Math.round(Number(minutos) || 0);
  if (n <= 0) return "";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
