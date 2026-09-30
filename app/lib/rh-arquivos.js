// Arquivos de RH no navegador — sempre pelo servidor.
//
// Documento, atestado, regulamento e foto de RH ficam no bucket privado
// `rh-docs`. O banco guarda storage://rh-docs/<caminho>; a URL para abrir é
// assinada pelo servidor na hora, dura poucos minutos e não é gravada.
// Ver app/lib/server/rh-arquivos.mjs. O hook de fotos fica em useFotosRH.js
// ("use client"): este módulo também é importado por código de servidor.

import { supabase, isSupabaseReady } from "./supabase";

async function tokenDeSessao() {
  if (!isSupabaseReady()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function pedir(rota, corpo) {
  const token = await tokenDeSessao();
  if (!token) return { erro: "Sessão expirada. Entre de novo." };
  try {
    const r = await fetch(rota, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return { erro: json.erro || "Não foi possível acessar o arquivo." };
    return json;
  } catch {
    return { erro: "Sem conexão com o servidor." };
  }
}

/** { "fonte:id": url } para cada item autorizado. Itens negados ficam de fora. */
export async function urlsAssinadasRH(itens) {
  const lista = (itens || []).filter((i) => i?.fonte && i?.id != null);
  if (!lista.length) return {};
  const mapa = {};
  for (let i = 0; i < lista.length; i += 60) {
    const r = await pedir("/api/rh/arquivos/assinar", { itens: lista.slice(i, i + 60) });
    for (const it of r.itens || []) if (it.ok && it.url) mapa[`${it.fonte}:${it.id}`] = it.url;
  }
  return mapa;
}

/**
 * Abre o arquivo de um registro numa aba nova. A aba é aberta ANTES da ida ao
 * servidor — senão o navegador trata como pop-up e bloqueia.
 */
export async function abrirArquivoRH(fonte, id) {
  const aba = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
  const r = await pedir("/api/rh/arquivos/assinar", { itens: [{ fonte, id }] });
  const item = r.itens?.[0];
  if (!item?.ok || !item.url) {
    if (aba) aba.close();
    alert(item?.mensagem || r.erro || "Não foi possível abrir o arquivo.");
    return;
  }
  if (aba) {
    try { aba.opener = null; } catch { /* navegador pode não permitir */ }
    aba.location.href = item.url;
  } else {
    window.location.href = item.url;
  }
}

/**
 * Envia um arquivo de RH. Devolve { ref } — é ISSO que se grava no banco.
 * @param {{ fonte: string, arquivo: File, donoId?: string|null, unidadeId?: string|null }} p
 */
export async function enviarArquivoRH({ fonte, arquivo, donoId = null, unidadeId = null }) {
  if (!arquivo) return { ref: null, error: "Escolha o arquivo." };
  const preparo = await pedir("/api/rh/arquivos/enviar", {
    fonte, donoId, unidadeId, nomeArquivo: arquivo.name, tamanho: arquivo.size,
  });
  if (preparo.erro) return { ref: null, error: preparo.erro };
  const { error } = await supabase.storage
    .from(preparo.bucket)
    .uploadToSignedUrl(preparo.path, preparo.token, arquivo, { contentType: arquivo.type || undefined });
  if (error) return { ref: null, error: "Falha no envio do arquivo." };
  return { ref: preparo.ref, error: null };
}

/** Apaga do armazenamento o arquivo do registro (o registro continua com quem chama). */
export async function removerArquivoRH(fonte, id) {
  const r = await pedir("/api/rh/arquivos/remover", { fonte, id });
  return { error: r.erro || null };
}
