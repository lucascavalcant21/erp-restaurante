// SEC-RH-1.3A · FASE 3 — tira os arquivos de RH de dentro do bucket PÚBLICO
// `anexos` e os leva para o privado `rh-docs`.
//
// `anexos` continua público (serve as imagens de produto do cardápio de
// delivery). Foto de colaborador e anexo das abas legadas (holerite,
// documento, curso, ata) não podem ficar lá.
//
// Três modos, do mais seguro ao definitivo:
//   node scripts/sec_rh_mover_fotos_anexos.mjs --env .env.local
//       simulação: só conta o que seria movido
//   ... --aplicar
//       copia cada arquivo para rh-docs e aponta o registro para a cópia.
//       O original FICA em anexos (rollback da FASE 2 continua possível).
//   ... --apagar-originais
//       apaga de anexos os originais cujos registros já apontam para rh-docs
//       e cuja cópia existe. Rode só depois de conferir as telas.
//
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. A chave
// não é impressa. Nenhum arquivo é baixado; nenhum nome de arquivo ou pessoa
// sai no terminal — só contagens.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { lerRef, montarRef } from "../app/lib/storage-ref.mjs";
import { FONTES, BUCKET_RH, arquivoPertence } from "../app/lib/server/rh-arquivos.mjs";

const args = process.argv.slice(2);
const iEnv = args.indexOf("--env");
if (iEnv >= 0) {
  for (const l of readFileSync(args[iEnv + 1], "utf8").split(/\r?\n/)) {
    const i = l.indexOf("=");
    if (i > 0 && !l.trimStart().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim();
  }
}
const APLICAR = args.includes("--aplicar");
const APAGAR = args.includes("--apagar-originais");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !CHAVE) { console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const HOST = new URL(URL_SB).host;
const db = createClient(URL_SB, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });

// Só as fontes cujo arquivo antigo morava em `anexos`.
const ALVOS = Object.entries(FONTES).filter(([, f]) => f.legado.some((l) => l.bucket === "anexos"));

async function donoDe(fonte, linha) {
  if (fonte.dono === "registro") return linha.unidade_id ? { unidadeId: String(linha.unidade_id), donoId: String(linha.id) } : null;
  const tabela = fonte.dono === "colaborador" ? "colaboradores" : "funcionarios";
  const { data } = await db.from(tabela).select("id, unidade_id").eq("id", linha[fonte.colunaDono]).maybeSingle();
  return data?.unidade_id ? { unidadeId: String(data.unidade_id), donoId: String(data.id) } : null;
}

const total = { encontrados: 0, movidos: 0, jaNoRhDocs: 0, semDono: 0, foraDoPadrao: 0, falhas: 0, originaisApagados: 0 };
console.log(`modo: ${APAGAR ? "APAGAR ORIGINAIS" : APLICAR ? "APLICAR (copia e aponta)" : "SIMULAÇÃO"}\n`);

for (const [fonteId, fonte] of ALVOS) {
  const colunas = ["id", fonte.coluna, fonte.colunaDono, fonte.dono === "registro" ? "unidade_id" : null].filter(Boolean);
  const { data: linhas, error } = await db.from(fonte.tabela).select(colunas.join(", ")).not(fonte.coluna, "is", null);
  if (error) { console.log(`${fonteId.padEnd(22)} tabela/coluna indisponível — pulada`); continue; }
  const c = { anexos: 0, movidos: 0, rhdocs: 0, semDono: 0, fora: 0, falhas: 0, apagados: 0 };

  for (const linha of linhas || []) {
    const valor = linha[fonte.coluna];
    const ref = lerRef(valor, { hostEsperado: HOST });
    if (!ref) continue;
    if (ref.bucket === BUCKET_RH) {
      c.rhdocs++;
      if (APAGAR) {
        // O registro já aponta para rh-docs; o original em anexos está no backup da FASE 2.
        const { data: bk } = await db.from("sec_rh_backup_urls").select("valor_antigo")
          .eq("tabela", fonte.tabela).eq("registro_id", String(linha.id)).eq("coluna", fonte.coluna).maybeSingle();
        const antigo = lerRef(bk?.valor_antigo, { hostEsperado: HOST });
        if (antigo?.bucket === "anexos") {
          const { data: existe } = await db.storage.from(BUCKET_RH).createSignedUrl(ref.path, 30);
          if (existe?.signedUrl) {
            const { error: e } = await db.storage.from("anexos").remove([antigo.path]);
            if (!e) c.apagados++; else c.falhas++;
          }
        }
      }
      continue;
    }
    if (ref.bucket !== "anexos") continue;
    c.anexos++;
    const dono = await donoDe(fonte, linha);
    if (!dono) { c.semDono++; continue; }
    if (!arquivoPertence(fonte, ref, dono)) { c.fora++; continue; }
    if (!APLICAR) continue;

    const ext = (ref.path.match(/\.([a-z0-9]{1,8})$/i)?.[1] || "bin").toLowerCase();
    const destino = `${dono.unidadeId}/${fonte.categoria}/${dono.donoId}/${randomUUID()}.${ext}`;
    const novaRef = montarRef(BUCKET_RH, destino);
    if (!arquivoPertence(fonte, lerRef(novaRef), dono)) { c.falhas++; continue; }

    const { error: eCopia } = await db.storage.from("anexos").copy(ref.path, destino, { destinationBucket: BUCKET_RH });
    if (eCopia) { c.falhas++; continue; }
    // Só troca se o valor ainda for o que lemos: não atropela edição feita no meio.
    const { data: trocou, error: eUp } = await db.from(fonte.tabela).update({ [fonte.coluna]: novaRef })
      .eq("id", linha.id).eq(fonte.coluna, valor).select("id");
    if (eUp || !trocou?.length) {
      await db.storage.from(BUCKET_RH).remove([destino]);
      c.falhas++;
      continue;
    }
    // Garante backup do valor original mesmo se a FASE 2 não tiver rodado.
    await db.from("sec_rh_backup_urls").upsert(
      { tabela: fonte.tabela, registro_id: String(linha.id), coluna: fonte.coluna, valor_antigo: String(valor) },
      { onConflict: "tabela,registro_id,coluna", ignoreDuplicates: true });
    c.movidos++;
  }

  console.log(`${fonteId.padEnd(22)} em anexos: ${String(c.anexos).padStart(3)} · movidos: ${String(c.movidos).padStart(3)} · já em rh-docs: ${String(c.rhdocs).padStart(3)} · sem dono: ${c.semDono} · fora do padrão: ${c.fora} · falhas: ${c.falhas}${APAGAR ? ` · originais apagados: ${c.apagados}` : ""}`);
  total.encontrados += c.anexos; total.movidos += c.movidos; total.jaNoRhDocs += c.rhdocs;
  total.semDono += c.semDono; total.foraDoPadrao += c.fora; total.falhas += c.falhas; total.originaisApagados += c.apagados;
}

// Arquivos em anexos/fotos que nenhum registro aponta: só contados.
const { data: soltos } = await db.storage.from("anexos").list("fotos", { limit: 1000 });
console.log(`\nobjetos em anexos/fotos (inclui os sem registro): ${(soltos || []).filter((o) => o.id).length}`);
console.log("\nTOTAL", total);
if (!APLICAR && !APAGAR) console.log("\nNada foi alterado. Para copiar e apontar: --aplicar");
if ((total.semDono || total.foraDoPadrao) && APLICAR) console.log("Registros 'sem dono' ou 'fora do padrão' ficaram como estão — precisam de revisão manual.");
