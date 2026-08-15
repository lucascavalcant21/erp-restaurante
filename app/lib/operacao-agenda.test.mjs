// Testes do motor de operação. Rodar: node app/lib/operacao-agenda.test.mjs
import {
  aconteceEm, execucoesPrevistas, statusDaExecucao, concluiuNoPrazo,
  dentroDoLimite, respostaConforme, itemVisivel, calcularScore, combinarDataHora,
} from "./operacao-agenda.mjs";

let falhas = 0;
const ok = (nome, condicao) => {
  if (condicao) console.log(`  ok   ${nome}`);
  else { console.log(`  FALHOU ${nome}`); falhas += 1; }
};

console.log("\nRecorrência");
{
  // 2026-08-15 é um sábado (dia 6)
  ok("diária acontece todo dia", aconteceEm({ frequencia: "diaria", ativo: true }, "2026-08-15"));
  ok("dias_semana pega sábado", aconteceEm({ frequencia: "dias_semana", dias_semana: [6], ativo: true }, "2026-08-15"));
  ok("dias_semana ignora dia fora", !aconteceEm({ frequencia: "dias_semana", dias_semana: [1, 2], ativo: true }, "2026-08-15"));
  ok("mensal no dia certo", aconteceEm({ frequencia: "mensal", dia_mes: 15, ativo: true }, "2026-08-15"));
  ok("mensal em outro dia não", !aconteceEm({ frequencia: "mensal", dia_mes: 10, ativo: true }, "2026-08-15"));
  ok("datas específicas", aconteceEm({ frequencia: "datas", datas: ["2026-08-15"], ativo: true }, "2026-08-15"));
  ok("agenda inativa nunca acontece", !aconteceEm({ frequencia: "diaria", ativo: false }, "2026-08-15"));
}

console.log("\nGeração de execuções (idempotência pela chave)");
{
  const agendas = [
    { id: "a1", processo_id: "p1", unidade_id: "u1", frequencia: "diaria", hora_inicio: "15:40", minutos_prazo: 120, ativo: true },
    { id: "a2", processo_id: "p2", unidade_id: "u1", frequencia: "dias_semana", dias_semana: [1], hora_inicio: "23:30", ativo: true },
  ];
  const previstas = execucoesPrevistas(agendas, "2026-08-15", { processos: [{ id: "p1", versao: 3 }] });
  ok("só a agenda do dia gera execução", previstas.length === 1);
  ok("guarda a versão do processo", previstas[0].processo_versao === 3);
  ok("horário previsto correto", new Date(previstas[0].previsto_para).getHours() === 15);
  ok("prazo = previsto + minutos", (new Date(previstas[0].prazo_ate) - new Date(previstas[0].previsto_para)) === 120 * 60000);
  // A chave (agenda, data, previsto) é sempre a mesma: rodar de novo não duplica.
  const denovo = execucoesPrevistas(agendas, "2026-08-15", {});
  ok("gerar duas vezes dá a mesma chave", denovo[0].previsto_para === previstas[0].previsto_para);
}

console.log("\nStatus calculado no servidor");
{
  const base = { previsto_para: combinarDataHora("2026-08-15", "15:40").toISOString(),
                 prazo_ate: combinarDataHora("2026-08-15", "17:40").toISOString(), status: "AGENDADA" };
  ok("antes da hora fica agendada", statusDaExecucao(base, combinarDataHora("2026-08-15", "14:00")) === "AGENDADA");
  ok("na hora fica disponível", statusDaExecucao(base, combinarDataHora("2026-08-15", "15:45")) === "DISPONIVEL");
  ok("passou do prazo fica atrasada", statusDaExecucao(base, combinarDataHora("2026-08-15", "18:00")) === "ATRASADA");
  ok("em andamento não vira atrasada", statusDaExecucao({ ...base, status: "EM_ANDAMENTO" }, combinarDataHora("2026-08-15", "18:00")) === "EM_ANDAMENTO");
  ok("concluída não muda", statusDaExecucao({ ...base, status: "CONCLUIDA" }, new Date()) === "CONCLUIDA");
  ok("no prazo", concluiuNoPrazo(base, combinarDataHora("2026-08-15", "16:00")));
  ok("fora do prazo", !concluiuNoPrazo(base, combinarDataHora("2026-08-15", "19:00")));
}

console.log("\nLimites numéricos e conformidade");
{
  const freezer = { tipo: "TEMPERATURA", valor_min: -25, valor_max: -18 };
  ok("temperatura dentro", dentroDoLimite(freezer, -20) === true);
  ok("temperatura acima reprova", dentroDoLimite(freezer, -10) === false);
  ok("temperatura abaixo reprova", dentroDoLimite(freezer, -30) === false);
  ok("sem número não avalia", dentroDoLimite(freezer, "abc") === null);
  ok("conforme por limite", respostaConforme(freezer, { valor_numero: -20 }) === true);
  ok("não conforme por limite", respostaConforme(freezer, { valor_numero: -10 }) === false);

  const feito = { tipo: "FEITO_NAO_FEITO" };
  ok("feito é conforme", respostaConforme(feito, { valor: "feito" }) === true);
  ok("não feito reprova", respostaConforme(feito, { valor: "nao_feito" }) === false);
  ok("N/A não pontua", respostaConforme(feito, { valor: "feito", nao_aplica: true }) === null);
}

console.log("\nLógica condicional");
{
  const item = { depende_item_id: "i1", depende_valor: "nao" };
  ok("aparece quando a resposta bate", itemVisivel(item, { i1: { valor: "nao" } }));
  ok("some quando não bate", !itemVisivel(item, { i1: { valor: "sim" } }));
  ok("some sem resposta ainda", !itemVisivel(item, {}));
  ok("item sem dependência sempre aparece", itemVisivel({ titulo: "x" }, {}));
}

console.log("\nScore operacional");
{
  const execucoes = [
    { status: "CONCLUIDA", itens_conformes: 10, itens_nao_conformes: 0 },
    { status: "CONCLUIDA_COM_ATRASO", itens_conformes: 8, itens_nao_conformes: 2 },
    { status: "ATRASADA", itens_conformes: 0, itens_nao_conformes: 0 },
  ];
  const s = calcularScore({ execucoes });
  ok("pontualidade = 1 de 2 concluídas no prazo", s.pontualidade === 50);
  ok("execução = 2 de 3", s.execucao === 66.7);
  ok("qualidade = 18 de 20", s.qualidade === 90);
  ok("score entre 0 e 100", s.score > 0 && s.score <= 100);
  ok("sem execuções não inventa score", calcularScore({ execucoes: [] }).score === null);
}

console.log(falhas ? `\n${falhas} teste(s) falharam\n` : "\nTodos os testes passaram\n");
process.exit(falhas ? 1 : 0);
