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

// Removemos MOCK_NOTAS

export async function fetchNotas(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: null };

  let q = supabase.from("notas_fiscais").select("*").order("data_emissao", { ascending: false }).order("hora_emissao", { ascending: false });
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function salvarNota(dados, unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Supabase offline" };
  const nota = carimbarUnidade(dados, unidadeId);
  if (!nota.unidade_id) nota.unidade_id = "todas"; // notas_fiscais exige unidade_id NOT NULL
  
  const { data, error } = await supabase.from("notas_fiscais").insert([nota]).select().single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function deletarNota(id) {
  if (!isSupabaseReady()) return { error: "Supabase offline" };
  const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * SIMULAÇÃO DE IA VISION (OCR)
 * Esta função finge enviar a imagem para o ChatGPT/Google Vision.
 * Atrasa 3 segundos e retorna um objeto parseado pseudo-aleatório.
 */
export async function simularLeituraOCR(imagemBase64) {
  try {
    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: imagemBase64 })
    });
    
    if (res.ok) {
      const dadosIA = await res.json();
      return dadosIA;
    } else {
      const errorText = await res.text();
      throw new Error(`Servidor retornou HTTP ${res.status}: ${errorText}`);
    }
  } catch (err) {
    console.error("ERRO REAL DA VERCEL:", err);
    throw err; // Lança o erro de verdade para a tela mostrar
  }
}

/**
 * Upload de Imagem de Nota para o Bucket
 */
export async function uploadImagemNota(base64Data, unidadeId) {
  if (!isSupabaseReady() || !base64Data) return { url: null, error: "Offline ou sem imagem" };
  try {
    // Converter base64 (data:image/jpeg;base64,...) para Blob
    const res = await fetch(base64Data);
    const blob = await res.blob();
    
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const fileName = `nota_${unidadeId}_${Date.now()}.${ext}`;
    
    const { data, error } = await supabase.storage
      .from("notas-fiscais")
      .upload(fileName, blob, { contentType: blob.type, upsert: false });
      
    if (error) return { url: null, error: error.message };
    
    const { data: pubData } = supabase.storage.from("notas-fiscais").getPublicUrl(fileName);
    return { url: pubData?.publicUrl || null, error: null };
  } catch (err) {
    return { url: null, error: err.message };
  }
}
