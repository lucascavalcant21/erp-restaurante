// Testes da tela inicial. O que importa aqui é não mostrar número errado com
// cara de certo: saudação trocada, venda das 22h caindo no dia seguinte,
// comparação injusta com o dia inteiro de ontem, item sem mínimo virando
// "estoque crítico".
import {
  saudacao, primeiroNome, resumirVendas, variacao, janelaSeteDias, resumirEquipe,
  reservasDoDia, proximosEventos, resumirContas, estoqueAbaixoDoMinimo, resumirMesas, dataLocalISO,
} from "./painel-inicio.mjs";

let falhas = 0;
function conferir(nome, recebido, esperado) {
  const ok = JSON.stringify(recebido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (recebido ${JSON.stringify(recebido)}, esperado ${JSON.stringify(esperado)})`}`);
}
const em = (a, m, d, h = 12, min = 0) => new Date(a, m - 1, d, h, min);

// Saudação: o print mostrava "Boa noite" às 11:37.
conferir("11:37 é bom dia", saudacao(em(2026, 10, 2, 11, 37)), "Bom dia");
conferir("12:00 é boa tarde", saudacao(em(2026, 10, 2, 12, 0)), "Boa tarde");
conferir("18:00 é boa noite", saudacao(em(2026, 10, 2, 18, 0)), "Boa noite");
conferir("02:00 é boa noite", saudacao(em(2026, 10, 2, 2, 0)), "Boa noite");
conferir("05:00 é bom dia", saudacao(em(2026, 10, 2, 5, 0)), "Bom dia");
conferir("primeiro nome", primeiroNome("lucas cavalcante"), "Lucas");
conferir("nome vazio", primeiroNome(""), "");

// Vendas: 7 dias terminando hoje, no fuso do aparelho.
const agora = em(2026, 10, 2, 14, 0);
const vendas = [
  { total: 100, created_at: em(2026, 10, 2, 9, 0).toISOString() },
  { total: 50.5, created_at: em(2026, 10, 2, 13, 59).toISOString() },
  { total: 999, created_at: em(2026, 10, 2, 10, 0).toISOString(), status: "cancelada" },
  { total: 80, created_at: em(2026, 10, 1, 13, 0).toISOString() },   // ontem antes das 14h
  { total: 300, created_at: em(2026, 10, 1, 22, 30).toISOString() }, // ontem à noite: não entra no "até agora"
  { total: 40, created_at: em(2026, 9, 26, 12, 0).toISOString() },   // 6 dias atrás: entra
  { total: 70, created_at: em(2026, 9, 25, 12, 0).toISOString() },   // 7 dias atrás: fora
  { total: 10, created_at: "data-invalida" },
];
const rv = resumirVendas(vendas, agora);
conferir("hoje soma sem a cancelada", rv.hoje, 150.5);
conferir("vendas de hoje", rv.qtdHoje, 2);
conferir("ontem até a mesma hora", rv.ontemAteAgora, 80);
conferir("ontem inteiro no gráfico", rv.dias[5].total, 380);
conferir("7 dias, último é hoje", [rv.dias.length, rv.dias[6].sigla, rv.dias[6].iso], [7, "hoje", "2026-10-02"]);
conferir("primeiro dia é 26/09", rv.dias[0].iso, "2026-09-26");
conferir("total da semana", rv.totalSemana, 570.5);
conferir("venda das 22h fica no dia dela", resumirVendas([{ total: 5, created_at: em(2026, 10, 1, 22, 0).toISOString() }], agora).dias[5].total, 5);

const j = janelaSeteDias(agora);
conferir("janela começa 26/09 00:00", [dataLocalISO(j.inicio), j.inicio.getHours()], ["2026-09-26", 0]);
conferir("janela termina 03/10 00:00", [dataLocalISO(j.fim), j.fim.getHours()], ["2026-10-03", 0]);

conferir("variação +50%", variacao(150, 100), 0.5);
conferir("sem base não compara", variacao(150, 0), null);

// Equipe
conferir("equipe", resumirEquipe([
  { hora_entrada: "x" },
  { hora_entrada: "x", hora_saida_intervalo: "x" },
  { hora_entrada: "x", hora_saida_intervalo: "x", hora_retorno_intervalo: "x" },
  { hora_entrada: "x", hora_saida: "x" },
  { hora_saida: "x" }, // sem entrada: ignora
]), { trabalhando: 2, intervalo: 1, encerraram: 1, presentes: 3 });

// Reservas
const rd = reservasDoDia([
  { data_reserva: "2026-10-02", horario: "20:00:00", qtd_pessoas: 4, cliente_nome: "B" },
  { data_reserva: "2026-10-02", horario: "19:30:00", qtd_pessoas: 2, cliente_nome: "A" },
  { data_reserva: "2026-10-02", horario: "21:00:00", qtd_pessoas: 6, status: "Cancelada" },
  { data_reserva: "2026-10-03", horario: "19:00:00", qtd_pessoas: 10 },
], "2026-10-02");
conferir("reservas do dia em ordem, sem cancelada", rd.lista.map((r) => r.cliente_nome), ["A", "B"]);
conferir("pessoas nas reservas", rd.pessoas, 6);

// Eventos
const pe = proximosEventos([
  { id: 1, data_evento: "2026-11-07", funil_status: "NEGOCIAÇÃO" },
  { id: 2, data_evento: "2026-10-02T00:00:00+00:00", funil_status: "CONFIRMADO" },
  { id: 3, data_evento: "2026-10-10", funil_status: "CANCELADO" },
  { id: 4, data_evento: "2026-09-30", funil_status: "CONFIRMADO" },
  { id: 5, data_evento: "2026-10-20", funil_status: "finalizado" },
  { id: 6, data_evento: null },
], "2026-10-02");
conferir("próximos em ordem, sem cancelado/finalizado/passado", pe.lista.map((e) => e.id), [2, 1]);
conferir("etapa normalizada", pe.lista[1].etapa, "NEGOCIACAO");
conferir("nos próximos 30 dias", pe.noPeriodo, 1);

// Contas
const rc = resumirContas([
  { situacao: "vencido", vencida: true, saldo: 100, data_vencimento: "2026-09-30" },
  { situacao: "parcial", vencida: true, saldo: 50.25, data_vencimento: "2026-10-01" },
  { situacao: "pendente", vencida: false, saldo: 30, data_vencimento: "2026-10-02" },
  { situacao: "pendente", vencida: false, saldo: 999, data_vencimento: "2026-10-09" },
  { situacao: "pago", vencida: false, saldo: 0, data_vencimento: "2026-10-02" },
  { situacao: "cancelado", vencida: true, saldo: 70, data_vencimento: "2026-09-01" },
], "2026-10-02");
conferir("contas vencidas", rc.vencidas, { qtd: 2, valor: 150.25 });
conferir("contas que vencem hoje", rc.hoje, { qtd: 1, valor: 30 });

// Estoque: item sem mínimo não conta, estoque inativo/fora da lista não conta.
const ea = estoqueAbaixoDoMinimo(
  [{ id: "c", nome: "Cozinha" }, { id: "b", nome: "Bar" }],
  [
    { estoque_id: "c", quantidade_atual: 1, estoque_minimo: 5 },
    { estoque_id: "c", quantidade_atual: 0, estoque_minimo: 2 },
    { estoque_id: "c", quantidade_atual: 0, estoque_minimo: null },
    { estoque_id: "c", quantidade_atual: 0, estoque_minimo: 0 },
    { estoque_id: "b", quantidade_atual: 5, estoque_minimo: 5 },
    { estoque_id: "b", quantidade_atual: 4, estoque_minimo: 5 },
    { estoque_id: "x", quantidade_atual: 0, estoque_minimo: 9 },
  ],
);
conferir("estoque abaixo do mínimo", ea, { total: 3, porEstoque: [{ id: "c", nome: "Cozinha", qtd: 2 }, { id: "b", nome: "Bar", qtd: 1 }] });

conferir("mesas", resumirMesas([{ comandas: [1] }, { comandas: [] }, {}, { comandas: [1, 2] }]), { total: 4, ocupadas: 2, taxa: 0.5 });

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
