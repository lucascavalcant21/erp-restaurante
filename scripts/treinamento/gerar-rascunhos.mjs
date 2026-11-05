// Gera db/treinamento/TREIN_2_RASCUNHOS.sql a partir de app/lib/treinamento-conteudo.
//   node scripts/treinamento/gerar-rascunhos.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pacoteDoTreinamento } from "../../app/lib/treinamento-conteudo/index.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const json = JSON.stringify(pacoteDoTreinamento());
if (json.includes("$trein$")) throw new Error("O conteúdo não pode conter o delimitador $trein$.");

const sql = `/* TREIN-2 · RASCUNHOS DO TREINAMENTO
   ARQUIVO GERADO por scripts/treinamento/gerar-rascunhos.mjs. Não edite à mão.

   STATUS: NÃO APLICADA. Aguarda APR-017, depois de TREIN_1_TREINAMENTO_POR_FUNCAO.sql.

   FAZ: carrega trilhas, módulos, aulas e questões na unidade seldeestrela. Tudo
   entra como RASCUNHO, invisível para a equipe até o dono aprovar. Só os módulos
   de pratos entram aprovados, porque mostram a ficha real, sem texto escrito.
   Rodar de novo não sobrescreve o que já foi editado.
   ROLLBACK: TREIN_1_ROLLBACK.sql. */

begin;

do $$
begin
  if to_regprocedure('public.trein_importar_pacote(text,jsonb)') is null then
    raise exception 'TREIN-2: aplique TREIN-1 antes. Nada foi alterado.';
  end if;
  if not exists (select 1 from public.unidades where id = 'seldeestrela') then
    raise exception 'TREIN-2: unidade seldeestrela não encontrada. Nada foi alterado.';
  end if;
end $$;

select public.trein_importar_pacote('seldeestrela', $trein$${json}$trein$::jsonb);

commit;

/* Conferência: módulos, aulas e trilhas carregados. */
select (select count(*) from public.trein_modulos) as modulos,
       (select count(*) from public.trein_aulas) as aulas,
       (select count(*) from public.trein_questoes) as questoes,
       (select count(*) from public.trein_trilhas) as trilhas;
`;
fs.writeFileSync(path.join(raiz, "db", "treinamento", "TREIN_2_RASCUNHOS.sql"), sql);
console.log("TREIN_2_RASCUNHOS.sql gerado:", Math.round(sql.length / 1024), "KB");
