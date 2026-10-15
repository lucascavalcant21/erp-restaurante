import test from "node:test";
import assert from "node:assert/strict";
import {
  validarItensPedido,
  validarChamadoGarcom,
  formatarCatalogoExperience,
  lancarPedidoMesaExperience,
  lerComandaMesaExperience,
  criarChamadoGarcomExperience,
  centavos,
  numeroSeguro
} from "./server/experience.mjs";

test("validarItensPedido - sanitização e integridade do carrinho", () => {
  // Carrinho vazio
  assert.equal(validarItensPedido([]).ok, false);
  assert.equal(validarItensPedido(null).ok, false);

  // Quantidade inválida
  assert.equal(validarItensPedido([{ id: "prod-1", quantidade: 0 }]).ok, false);
  assert.equal(validarItensPedido([{ id: "prod-1", quantidade: -2 }]).ok, false);
  assert.equal(validarItensPedido([{ id: "prod-1", quantidade: 1.5 }]).ok, false);
  assert.equal(validarItensPedido([{ id: "prod-1", quantidade: 999 }]).ok, false);

  // Id inválido
  assert.equal(validarItensPedido([{ id: "prod with spaces!", quantidade: 1 }]).ok, false);

  // Válido com observação
  const r = validarItensPedido([
    { id: "prod-1", quantidade: 2, observacao: "Sem cebola" },
    { id: "prod-2", quantidade: 1, observacao: "Ao ponto" }
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.itens.length, 2);
  assert.equal(r.itens[0].quantidade, 2);
  assert.equal(r.itens[0].observacao, "Sem cebola");
});

test("validarChamadoGarcom - tipos de chamada e número da mesa", () => {
  // Tipos permitidos
  assert.equal(validarChamadoGarcom({ tipo: "agua", mesaNumero: "04" }).ok, true);
  assert.equal(validarChamadoGarcom({ tipo: "conta", mesaNumero: "10" }).ok, true);
  assert.equal(validarChamadoGarcom({ tipo: "talheres", mesaNumero: "01" }).ok, true);
  assert.equal(validarChamadoGarcom({ tipo: "garcom", mesaNumero: "02" }).ok, true);

  // Tipo desconhecido
  assert.equal(validarChamadoGarcom({ tipo: "massagem", mesaNumero: "04" }).ok, false);

  // Mesa vazia
  assert.equal(validarChamadoGarcom({ tipo: "agua", mesaNumero: "" }).ok, false);
});

test("formatarCatalogoExperience - agrupamento e ordenação gastronômica", () => {
  const produtos = [
    { id: "p1", nome_produto: "Petit Gâteau", categoria: "Sobremesas", preco_venda: "32.00", departamento: "cozinha" },
    { id: "p2", nome_produto: "Pirarucu Amazônico", categoria: "Pratos Principais", preco_venda: "89.50", departamento: "cozinha" },
    { id: "p3", nome_produto: "Dadinho de Tapioca", categoria: "Entradas", preco_venda: "42.00", departamento: "cozinha" },
    { id: "p4", nome_produto: "Caipirinha Caju", categoria: "Drinks", preco_venda: "35.00", departamento: "bar" }
  ];

  const unidade = { id: "seldeestrela", nome_fantasia: "Seldeestrela", delivery_aberto: true };
  const catalogo = formatarCatalogoExperience(produtos, unidade);

  assert.equal(catalogo.unidade.nome, "Seldeestrela");
  assert.equal(catalogo.produtos.length, 4);
  
  // Ordem gastronômica: Entradas deve vir antes de Pratos Principais e Sobremesas
  assert.equal(catalogo.categorias[0], "Entradas");
  assert.equal(catalogo.categorias[1], "Pratos Principais");
  assert.equal(catalogo.categorias.includes("Drinks"), true);
  assert.equal(catalogo.categorias.includes("Sobremesas"), true);
});

test("lancarPedidoMesaExperience - calcula preço pelo banco e garante comanda aberta", async () => {
  // Mock do banco de dados
  let comandaAberta = null;
  let itensGravados = [];

  const mockDb = {
    from: (tabela) => {
      if (tabela === "mesas") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "mesa-uuid-4", numero: "04", status: "livre" } })
              })
            })
          }),
          update: () => ({ eq: async () => ({ error: null }) })
        };
      }

      if (tabela === "pedidos") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    maybeSingle: async () => ({ data: comandaAberta })
                  })
                })
              })
            })
          }),
          insert: (pedidos) => ({
            select: () => ({
              single: async () => {
                comandaAberta = { id: "ped-uuid-1", valor_total: 0, ...pedidos[0] };
                return { data: comandaAberta, error: null };
              }
            })
          }),
          update: (dados) => ({
            eq: async () => {
              if (comandaAberta) Object.assign(comandaAberta, dados);
              return { error: null };
            }
          })
        };
      }

      if (tabela === "produtos") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({
                  data: [
                    { id: "prod-1", nome_produto: "Pirarucu", preco_venda: 90.00, departamento: "cozinha" },
                    { id: "prod-2", nome_produto: "Suco Cupuaçu", preco_venda: 15.50, departamento: "bar" }
                  ],
                  error: null
                })
              })
            })
          })
        };
      }

      if (tabela === "pedidos_itens") {
        return {
          insert: (itens) => {
            itensGravados.push(...itens);
            return {
              select: async () => ({ data: itens, error: null })
            };
          }
        };
      }

      throw new Error(`Tabela não mockada: ${tabela}`);
    }
  };

  const resultado = await lancarPedidoMesaExperience({
    db: mockDb,
    unidadeId: "seldeestrela",
    mesaNumero: "04",
    itens: [
      { id: "prod-1", quantidade: 1, observacao: "Sem pimenta" },
      { id: "prod-2", quantidade: 2, observacao: "" }
    ],
    clienteNome: "Lucas",
    chaveIdempotencia: "req-12345"
  });

  assert.equal(resultado.ok, true);
  // Total esperado: 1 x 90.00 + 2 x 15.50 = 121.00
  assert.equal(resultado.totalPedido, 121.00);
  assert.equal(itensGravados.length, 2);
  assert.equal(itensGravados[0].status_kds, "pendente");
  assert.equal(itensGravados[0].valor_unitario, 90.00);
  assert.equal(itensGravados[1].valor_unitario, 15.50);

  // Teste de idempotência (mesma chave não deve duplicar)
  const reenvio = await lancarPedidoMesaExperience({
    db: mockDb,
    unidadeId: "seldeestrela",
    mesaNumero: "04",
    itens: [{ id: "prod-1", quantidade: 1 }],
    chaveIdempotencia: "req-12345"
  });

  assert.equal(reenvio.ok, true);
  assert.equal(reenvio.idempotente, true);
});

test("lerComandaMesaExperience - exibe extrato e total da mesa", async () => {
  const mockDb = {
    from: (tabela) => {
      if (tabela === "mesas") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "mesa-uuid-4", numero: "04", status: "ocupada" } })
              })
            })
          })
        };
      }
      if (tabela === "pedidos") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "ped-1",
                        valor_total: 121.00,
                        created_at: new Date().toISOString(),
                        pedidos_itens: [
                          {
                            id: "it-1",
                            quantidade: 1,
                            valor_unitario: 90.00,
                            status_kds: "em_preparo",
                            produtos: { nome_produto: "Pirarucu", departamento: "cozinha" }
                          },
                          {
                            id: "it-2",
                            quantidade: 2,
                            valor_unitario: 15.50,
                            status_kds: "pronto",
                            produtos: { nome_produto: "Suco Cupuaçu", departamento: "bar" }
                          }
                        ]
                      }
                    })
                  })
                })
              })
            })
          })
        };
      }
      throw new Error(`Tabela não mockada: ${tabela}`);
    }
  };

  const comanda = await lerComandaMesaExperience({
    db: mockDb,
    unidadeId: "seldeestrela",
    mesaNumero: "04"
  });

  assert.equal(comanda.ok, true);
  assert.equal(comanda.total, 121.00);
  assert.equal(comanda.itens.length, 2);
  assert.equal(comanda.itens[0].nome, "Pirarucu");
  assert.equal(comanda.itens[0].status_kds, "em_preparo");
  assert.equal(comanda.itens[1].subtotal, 31.00);
});

test("criarChamadoGarcomExperience - validação e registro", async () => {
  let chamadoRegistrado = null;
  const mockDb = {
    from: (tabela) => {
      if (tabela === "mesas") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "m-1", numero: "04" } })
              })
            })
          })
        };
      }
      if (tabela === "experience_chamados") {
        return {
          insert: (chamados) => {
            chamadoRegistrado = chamados[0];
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "cham-1", tipo: chamadoRegistrado.tipo, mesa_numero: "04", status: "pendente" },
                  error: null
                })
              })
            };
          }
        };
      }
      throw new Error(`Tabela não mockada: ${tabela}`);
    }
  };

  const r = await criarChamadoGarcomExperience({
    db: mockDb,
    unidadeId: "seldeestrela",
    mesaNumero: "04",
    tipo: "agua",
    solicitanteNome: "Maria"
  });

  assert.equal(r.ok, true);
  assert.equal(chamadoRegistrado.tipo, "agua");
  assert.equal(chamadoRegistrado.mesa_numero, "04");
  assert.equal(chamadoRegistrado.solicitante_nome, "Maria");
});
