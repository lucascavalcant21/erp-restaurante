/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMADA DE DADOS: Gestão de Notas Fiscais e DANFE (Com simulação OCR)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SQL para o Supabase:
 *
 *   create table notas_fiscais (
 *     id uuid primary key default gen_random_uuid(),
 *     unidade_id text not null,
 *     fornecedor text not null,
 *     cnpj text,
 *     data_emissao date not null,
 *     hora_emissao text,
 *     categoria text,
 *     valor_total numeric not null default 0,
 *     imagem_url text, -- Armazenaria o base64 ou link do bucket
 *     status text default 'registrada',
 *     itens jsonb default '[]',
 *     created_at timestamptz default now()
 *   );
 * 
 *   alter table notas_fiscais enable row level security;
 *   create policy "auth_all" on notas_fiscais for all to authenticated using (true) with check (true);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseReady } from "./supabase";
import { carimbarUnidade } from "./unidades";

export const CATEGORIAS_NOTA = [
  "Hortifruti", "Açougue/Proteína", "Laticínios", "Secos e Molhados", 
  "Bebidas", "Limpeza", "Embalagens", "Outros"
];

// Seed fallback
let MOCK_NOTAS = [
  { id: "n1", unidade_id: "seldeestrela", fornecedor: "Frigorífico Boi Gordo", cnpj: "12.345.678/0001-90", data_emissao: "2026-06-10", hora_emissao: "08:30", categoria: "Açougue/Proteína", valor_total: 1250.00, imagem_url: null, status: "registrada", itens: [], created_at: new Date().toISOString() },
  { id: "n2", unidade_id: "todas", fornecedor: "Atacadão das Bebidas", cnpj: "98.765.432/0001-10", data_emissao: "2026-06-11", hora_emissao: "14:15", categoria: "Bebidas", valor_total: 890.50, imagem_url: null, status: "registrada", itens: [], created_at: new Date().toISOString() },
];

export async function fetchNotas(unidadeId) {
  if (!isSupabaseReady()) {
    let filt = MOCK_NOTAS;
    if (unidadeId && unidadeId !== "todas") filt = filt.filter(n => n.unidade_id === unidadeId || n.unidade_id === "todas");
    return { data: [...filt].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), error: null };
  }

  let q = supabase.from("notas_fiscais").select("*").order("data_emissao", { ascending: false }).order("hora_emissao", { ascending: false });
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  
  try {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: data || [], error: null };
  } catch (err) {
    let filt = MOCK_NOTAS;
    if (unidadeId && unidadeId !== "todas") filt = filt.filter(n => n.unidade_id === unidadeId || n.unidade_id === "todas");
    return { data: [...filt].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)), error: null }; // Fallback
  }
}

export async function salvarNota(dados, unidadeId) {
  const nota = carimbarUnidade(dados, unidadeId);
  
  if (!isSupabaseReady()) {
    nota.id = "n" + Date.now();
    nota.created_at = new Date().toISOString();
    MOCK_NOTAS.push(nota);
    return { data: nota, error: null };
  }

  try {
    const { data, error } = await supabase.from("notas_fiscais").insert([nota]).select().single();
    if (error) throw new Error(error.message);
    return { data, error: null };
  } catch (err) {
    nota.id = "n" + Date.now();
    nota.created_at = new Date().toISOString();
    MOCK_NOTAS.unshift(nota);
    return { data: nota, error: null }; // Fallback
  }
}

export async function deletarNota(id) {
  if (!isSupabaseReady()) {
    MOCK_NOTAS = MOCK_NOTAS.filter(n => n.id !== id);
    return { error: null };
  }
  try {
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { error: null };
  } catch (err) {
    MOCK_NOTAS = MOCK_NOTAS.filter(n => n.id !== id);
    return { error: null }; // Fallback
  }
}

/**
 * SIMULAÇÃO DE IA VISION (OCR)
 * Esta função finge enviar a imagem para o ChatGPT/Google Vision.
 * Atrasa 3 segundos e retorna um objeto parseado pseudo-aleatório.
 */
export async function simularLeituraOCR(imagemBase64) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const hf = Math.random() > 0.5;
      resolve({
        fornecedor: hf ? "Ceasa Distribuidora de Frutas" : "Distribuidora Bebidas Frias",
        cnpj: hf ? "44.555.666/0001-77" : "88.999.000/0001-22",
        data_emissao: new Date().toISOString().slice(0, 10), // Hoje
        hora_emissao: `${String(Math.floor(Math.random() * 12) + 6).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}`,
        categoria: hf ? "Hortifruti" : "Bebidas",
        valor_total: Number((Math.random() * 1000 + 100).toFixed(2)),
        itens: hf 
          ? [{ nome: "Tomate Carmem", qtd: 10, un: "KG", preco: 7.5 }, { nome: "Alface Crespa", qtd: 20, un: "UN", preco: 2.0 }]
          : [{ nome: "Cerveja Pilsen 600ml", qtd: 4, un: "CX", preco: 120.0 }]
      });
    }, 3500); // 3.5s de delay para o "Show" UX
  });
}
