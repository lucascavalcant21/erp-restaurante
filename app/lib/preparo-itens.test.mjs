// Rode: node --test app/lib/preparo-itens.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { TEMPO_PADRAO_MIN, prontosDaComanda, prontosNovos, relogio, situacaoDoItem, tempoDoItem } from "./preparo-itens.mjs";

const T0 = Date.parse("2026-11-07T15:00:00-03:00");
const item = (extra) => ({ id: "i1", status_kds: "pendente", created_at: new Date(T0).toISOString(), produtos: { nome_produto: "Banda de tambaqui", tempo_preparo_base: 50 }, ...extra });

test("tempo do item: do produto; sem cadastro ou absurdo, o padrão", () => {
  assert.equal(tempoDoItem(item()), 50);
  assert.equal(tempoDoItem({ produtos: {} }), TEMPO_PADRAO_MIN);
  assert.equal(tempoDoItem({ produtos: { tempo_preparo_base: 0 } }), TEMPO_PADRAO_MIN);
  assert.equal(tempoDoItem({ produtos: { tempo_preparo_base: 9999 } }), TEMPO_PADRAO_MIN);
});

test("contagem regressiva: tambaqui de 50 min lançado agora", () => {
  const s = situacaoDoItem(item(), T0 + 7 * 60000 + 50000); // 7m50s depois
  assert.equal(s.estado, "fila");
  assert.equal(s.restanteSeg, 42 * 60 + 10);
  assert.equal(relogio(s.restanteSeg), "42:10");
  assert.equal(s.atrasado, false);
  const a = situacaoDoItem(item({ status_kds: "preparando" }), T0 + 53 * 60000);
  assert.equal(a.estado, "preparando");
  assert.equal(a.atrasado, true);
  assert.equal(relogio(a.restanteSeg), "3:00");
});

test("pronto, servido e cancelado", () => {
  const p = situacaoDoItem(item({ status_kds: "pronto", updated_at: new Date(T0 + 48 * 60000).toISOString() }), T0 + 51 * 60000);
  assert.deepEqual(p, { estado: "pronto", prontoHaMin: 3 });
  assert.deepEqual(situacaoDoItem(item({ status_kds: "entregue" })), { estado: "servido" });
  assert.deepEqual(situacaoDoItem(item({ status_kds: "cancelado" })), { estado: "cancelado" });
  assert.equal(relogio(4000), "1h06");
});

test("aviso de pronto: só o que ficou pronto agora, do garçom ou da comanda sem garçom", () => {
  const mesas = [{ id: "m4", numero_mesa: "4" }, { id: "m5", numero: "Mesa 5" }];
  const pedidos = [
    { mesa_id: "m4", garcom_nome: "Larissa", pedidos_itens: [item({ id: "a", status_kds: "pronto", quantidade: 2, produtos: { nome_produto: "Tacacá" } }), item({ id: "b" })] },
    { mesa_id: "m5", garcom_nome: "Caio", pedidos_itens: [item({ id: "c", status_kds: "pronto" })] },
  ];
  // Ao abrir a tela, o que já estava pronto não toca alerta.
  const abertura = prontosNovos({ pedidos, mesas, garcom: "Larissa", primeiraLeitura: true });
  assert.deepEqual(abertura.alertas, []);
  assert.deepEqual([...abertura.vistos].sort(), ["a", "c"]);
  // A cozinha marca "b" como pronto.
  pedidos[0].pedidos_itens[1].status_kds = "pronto";
  const r = prontosNovos({ vistos: abertura.vistos, pedidos, mesas, garcom: "Larissa" });
  assert.deepEqual(r.alertas, [{ itemId: "b", mesaId: "m4", mesa: "Mesa 4", quantidade: 1, nome: "Banda de tambaqui" }]);
  // Item pronto de outro garçom não avisa; comanda sem garçom avisa a todos.
  pedidos.push({ mesa_id: "m5", garcom_nome: null, pedidos_itens: [item({ id: "d", status_kds: "pronto" })] });
  pedidos[1].pedidos_itens.push(item({ id: "e", status_kds: "pronto" }));
  const r2 = prontosNovos({ vistos: r.vistos, pedidos, mesas, garcom: "Larissa" });
  assert.deepEqual(r2.alertas.map((x) => [x.itemId, x.mesa]), [["d", "Mesa 5"]]);
  assert.equal(prontosNovos({ vistos: r2.vistos, pedidos, mesas, garcom: "Larissa" }).alertas.length, 0, "não repete");
  assert.equal(prontosDaComanda(pedidos[0]), 2);
  // Cozinha tocou "Entregar pedido" direto (pendente → entregue): também avisa.
  pedidos[0].pedidos_itens.push(item({ id: "f", status_kds: "entregue" }));
  const r3 = prontosNovos({ vistos: r2.vistos, pedidos, mesas, garcom: "Larissa" });
  assert.deepEqual(r3.alertas.map((x) => x.itemId), ["f"]);
  // O garçom serviu o "b" (pronto → entregue): já visto, não repete.
  pedidos[0].pedidos_itens[1].status_kds = "entregue";
  assert.equal(prontosNovos({ vistos: r3.vistos, pedidos, mesas, garcom: "Larissa" }).alertas.length, 0);
});
