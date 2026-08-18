"use client";

import { supabase, isSupabaseReady } from "./supabase";

// Evidência da execução guiada: a foto vive no storage e o banco guarda só o
// caminho, a prova (hash) e o contexto (quem tirou, quando e onde). Foto em
// base64 dentro da tabela incharia cada leitura da execução — que acontece no
// celular do salão, no 4G — e é justamente o que o desenho do módulo evitou.

const BUCKET = "anexos";
const PASTA = "operacao";

const EVIDENCIA_MAX_LADO = 1600;
const EVIDENCIA_QUALIDADE = 0.82;

// Celular tira foto de 5 a 10 MB. Sem reduzir, o upload trava na cozinha e
// ainda estoura o limite de corpo da requisição quando a foto vai para a IA.
function dataUrlParaArquivo(dataUrl) {
  const [cabecalho, dados] = String(dataUrl).split(",");
  const mediaType = (cabecalho.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const binario = atob(dados || "");
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mediaType }), base64: dados || "", mediaType };
}

export function comprimirFoto(file, maxLado = EVIDENCIA_MAX_LADO, qualidade = EVIDENCIA_QUALIDADE) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não consegui ler o arquivo da foto."));
    leitor.onload = (evento) => {
      const img = new Image();
      // Foto que o navegador não consegue desenhar sobe do jeito que veio:
      // evidência ruim ainda é melhor que evidência nenhuma.
      img.onerror = () => resolve(dataUrlParaArquivo(evento.target.result));
      img.onload = () => {
        try {
          let largura = img.width;
          let altura = img.height;
          if (largura > altura && largura > maxLado) {
            altura = Math.round((altura * maxLado) / largura);
            largura = maxLado;
          } else if (altura > maxLado) {
            largura = Math.round((largura * maxLado) / altura);
            altura = maxLado;
          }
          const tela = document.createElement("canvas");
          tela.width = largura;
          tela.height = altura;
          tela.getContext("2d").drawImage(img, 0, 0, largura, altura);
          resolve(dataUrlParaArquivo(tela.toDataURL("image/jpeg", qualidade)));
        } catch {
          resolve(dataUrlParaArquivo(evento.target.result));
        }
      };
      img.src = evento.target.result;
    };
    leitor.readAsDataURL(file);
  });
}

// GPS do aparelho. Devolve erro em vez de lançar: item que exige localização
// precisa dizer POR QUE não conseguiu, senão o funcionário fica travado sem
// entender (permissão negada e sinal fraco pedem atitudes diferentes).
export function capturarLocalizacao({ timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ error: "Este aparelho não informa localização." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => resolve({
        data: {
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisao: posicao.coords.accuracy,
        },
      }),
      (erro) => resolve({
        error: erro?.code === 1
          ? "Permissão de localização negada no aparelho."
          : erro?.message || "Não consegui ler a localização.",
      }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

// Impressão digital do arquivo: se alguém trocar a foto no storage depois, o
// hash gravado no dia da execução denuncia.
async function hashDoArquivo(blob) {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buffer = await blob.arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export async function conferirEvidenciaComIA({ base64, mediaType, criterios, itemTitulo }) {
  try {
    const resposta = await fetch("/api/ia-evidencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagem_base64: base64,
        imagem_media_type: mediaType,
        criterios,
        item_titulo: itemTitulo || "",
      }),
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) return { error: json?.error || "A IA não conseguiu conferir a foto." };
    return { data: json };
  } catch (e) {
    return { error: e?.message || "A IA não respondeu." };
  }
}

// Sobe a foto, confere com a IA quando o item pede e grava a linha de prova.
// A ordem importa: se o INSERT falhar depois do upload, o arquivo é apagado —
// storage com foto órfã ninguém limpa depois.
export async function salvarEvidencia({
  execucaoId, itemId, unidadeId, file, usuario,
  criteriosIa = "", itemTitulo = "", exigeGps = false,
}) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  if (!execucaoId || !itemId) return { error: "Execução inválida." };
  if (!file && !exigeGps) return { error: "Nada para registrar." };

  let gps = null;
  if (exigeGps) {
    const local = await capturarLocalizacao();
    if (local.error) return { error: `Este item exige localização: ${local.error}` };
    gps = local.data;
  }

  let caminho = null;
  let url = null;
  let hash = null;
  let foto = null;
  if (file) {
    try {
      foto = await comprimirFoto(file);
    } catch (e) {
      return { error: e?.message || "Não consegui preparar a foto." };
    }
    caminho = `${PASTA}/${unidadeId || "sem-unidade"}/${execucaoId}/${itemId}-${Date.now()}.jpg`;
    const envio = await supabase.storage.from(BUCKET)
      .upload(caminho, foto.blob, { contentType: foto.mediaType, upsert: false });
    if (envio.error) return { error: `Não consegui enviar a foto: ${envio.error.message}` };
    url = supabase.storage.from(BUCKET).getPublicUrl(caminho).data?.publicUrl || null;
    hash = await hashDoArquivo(foto.blob);
  }

  // Conferência por IA só quando o item descreve o que a foto precisa mostrar.
  // Falha da IA não invalida a evidência: fica como "revisar" para o gestor.
  let ia = null;
  if (foto && String(criteriosIa || "").trim()) {
    const conferencia = await conferirEvidenciaComIA({
      base64: foto.base64, mediaType: foto.mediaType,
      criterios: criteriosIa, itemTitulo,
    });
    ia = conferencia.data || { status: "revisar", confianca: null, motivo: conferencia.error || null };
  }

  const { data, error } = await supabase.from("op_evidencias").insert([{
    execucao_id: execucaoId,
    item_id: itemId,
    unidade_id: String(unidadeId || ""),
    arquivo_caminho: caminho,
    arquivo_url: url,
    tipo: file ? "foto" : "gps",
    usuario: usuario?.nome || null,
    latitude: gps?.latitude ?? null,
    longitude: gps?.longitude ?? null,
    precisao_gps: gps?.precisao ?? null,
    dispositivo: typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 200) : null,
    hash_arquivo: hash,
    ia_status: ia?.status || null,
    ia_confianca: ia?.confianca ?? null,
    ia_motivo: ia?.motivo || null,
    status: "valida",
  }]).select().single();

  if (error) {
    if (caminho) await supabase.storage.from(BUCKET).remove([caminho]).catch(() => {});
    return { error: error.message };
  }
  return { data };
}

// Evidência não se apaga de verdade: vira 'descartada' e some da tela, mas o
// registro de que existiu continua lá para a auditoria.
export async function descartarEvidencia(evidenciaId, usuario) {
  if (!isSupabaseReady() || !evidenciaId) return { error: "Evidência inválida." };
  const { error } = await supabase.from("op_evidencias").update({
    status: "descartada",
    revisado_por: usuario?.nome || null,
    revisado_em: new Date().toISOString(),
  }).eq("id", evidenciaId);
  return { error: error?.message || null };
}
