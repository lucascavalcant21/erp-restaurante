import test from "node:test";
import assert from "node:assert/strict";
import {
  validarItensPedido,
  validarChamadoGarcom,
  formatarCatalogoExperience,
  lerCardapioExperience,
  lancarPedidoMesaExperience,
  lerComandaMesaExperience,
  criarChamadoGarcomExperience,
  calcularDivisaoConta,
  sanitizarModificadoresPrato,
  obterMetricasIntelligenceExperience,
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
              limit: async () => ({ data: [{ id: "m-1", numero: "Mesa 04" }, { id: "m-2", numero: "Mesa 05" }] })
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
  assert.equal(chamadoRegistrado.mesa_id, "m-1", "liga à mesa cadastrada no Salão (\"Mesa 04\")");
  assert.equal(chamadoRegistrado.solicitante_nome, "Maria");
});

test("criarChamadoGarcomExperience - \"Mesa 5\" vira 5; tocar de novo não abre outro; restaurante inexistente", async () => {
  const banco = (erroInsert) => {
    const gravados = [];
    return {
      gravados,
      from: (tabela) => tabela === "mesas"
        ? { select: () => ({ eq: () => ({ limit: async () => ({ data: [{ id: "m-5", numero: "Mesa 5" }] }) }) }) }
        : { insert: (l) => { gravados.push(l[0]); return { select: () => ({ single: async () => (erroInsert ? { data: null, error: erroInsert } : { data: { id: "c-1" }, error: null }) }) }; } },
    };
  };
  const b1 = banco(null);
  const r1 = await criarChamadoGarcomExperience({ db: b1, unidadeId: "seldeestrela", mesaNumero: "Mesa 5", tipo: "conta" });
  assert.equal(r1.ok, true);
  assert.equal(r1.tipo, "conta");
  assert.equal(b1.gravados[0].mesa_numero, "5");
  assert.equal(b1.gravados[0].mesa_id, "m-5");

  const r2 = await criarChamadoGarcomExperience({ db: banco({ code: "23505", message: "duplicate key" }), unidadeId: "seldeestrela", mesaNumero: "5", tipo: "garcom" });
  assert.equal(r2.ok, true, "chamado já aberto: a equipe já sabe");
  assert.equal(r2.jaAberto, true);

  const r3 = await criarChamadoGarcomExperience({ db: banco({ code: "23503", message: "fk" }), unidadeId: "nao-existe", mesaNumero: "5", tipo: "garcom" });
  assert.equal(r3.ok, false);
  assert.equal(r3.status, 404);

  const r4 = await criarChamadoGarcomExperience({ db: banco(null), unidadeId: "seldeestrela", mesaNumero: "Mesa !!", tipo: "garcom" });
  assert.equal(r4.ok, false, "mesa sem letra nem número é recusada");
});

test("calcularDivisaoConta - cálculo exato com e sem taxa de serviço", () => {
  // 1 pessoa com 10%
  const r1 = calcularDivisaoConta({ subtotal: 100, quantidadePessoas: 1, incluirServico: true, percentualServico: 10 });
  assert.equal(r1.subtotal, 100);
  assert.equal(r1.taxaServico, 10);
  assert.equal(r1.totalGeral, 110);
  assert.equal(r1.valorPorPessoa, 110);

  // 4 pessoas com 10% de R$ 200,00 -> total 220,00 -> 55,00 por pessoa
  const r2 = calcularDivisaoConta({ subtotal: 200, quantidadePessoas: 4, incluirServico: true });
  assert.equal(r2.subtotal, 200);
  assert.equal(r2.taxaServico, 20);
  assert.equal(r2.totalGeral, 220);
  assert.equal(r2.valorPorPessoa, 55);

  // 3 pessoas sem serviço de R$ 150,00 -> 50,00 cada
  const r3 = calcularDivisaoConta({ subtotal: 150, quantidadePessoas: 3, incluirServico: false });
  assert.equal(r3.subtotal, 150);
  assert.equal(r3.taxaServico, 0);
  assert.equal(r3.totalGeral, 150);
  assert.equal(r3.valorPorPessoa, 50);

  // Limite de pessoas: 0 deve virar ao menos 1
  const r4 = calcularDivisaoConta({ subtotal: 80, quantidadePessoas: 0 });
  assert.equal(r4.quantidadePessoas, 1);
  assert.equal(r4.valorPorPessoa, 88);
});

test("sanitizarModificadoresPrato - concatenação de modificadores estruturados", () => {
  const mod = sanitizarModificadoresPrato({
    pontoCarne: "Ao ponto",
    remocoes: ["Sem cebola", "Sem pimenta"],
    adicionais: ["Molho extra"],
    textoLivre: "Caprichar no ponto"
  });

  assert.equal(mod, "Ao ponto • Sem cebola, Sem pimenta • Molho extra • Caprichar no ponto");

  // Vazio
  assert.equal(sanitizarModificadoresPrato({}), "");
});

test("obterMetricasIntelligenceExperience - consolidação de kpis e chamados", async () => {
  const mockDb = {
    from: (tabela) => {
      if (tabela === "pedidos") {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: [
                  { id: "ped-1", valor_total: 150, origem_experience: true, created_at: new Date().toISOString() },
                  { id: "ped-2", valor_total: 250, origem_experience: true, created_at: new Date().toISOString() },
                  { id: "ped-3", valor_total: 100, origem_experience: false, created_at: new Date().toISOString() }
                ]
              })
            })
          })
        };
      }
      if (tabela === "experience_chamados") {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: [
                  { id: "c-1", tipo: "garcom", status: "concluido", created_at: "2026-10-15T18:00:00Z", concluido_em: "2026-10-15T18:04:00Z" },
                  { id: "c-2", tipo: "agua", status: "pendente", created_at: "2026-10-15T18:10:00Z" }
                ]
              })
            })
          })
        };
      }
      if (tabela === "experience_campanhas") {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { id: "camp-1", produto_nome: "Drink Amazônia", visualizacoes: 100, cliques: 30, adicoes_carrinho: 20, compras_efetivas: 15, receita_gerada: 525, status: "ativa" }
              ]
            })
          })
        };
      }
      throw new Error(`Tabela não mockada: ${tabela}`);
    }
  };

  const res = await obterMetricasIntelligenceExperience({ db: mockDb, unidadeId: "seldeestrela", dias: 7 });
  assert.equal(res.ok, true);
  assert.equal(res.metricas.totalPedidosExp, 2);
  assert.equal(res.metricas.faturamentoExp, 400);
  assert.equal(res.metricas.ticketMedioExp, 200);
  assert.equal(res.metricas.chamados.total, 2);
  assert.equal(res.metricas.chamados.concluidos, 1);
  assert.equal(res.metricas.chamados.pendentes, 1);
  assert.equal(res.metricas.campanhas.totalCampanhas, 1);
});


// ─── B-028: nada de prato, pedido ou chamado de mentira ─────────────────────

test("lerCardapioExperience - sem banco ou com erro não mostra pratos de demonstração", async () => {
  assert.equal((await lerCardapioExperience({ db: null, unidadeId: "seldeestrela" })).status, 503);
  const comErro = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "boom" } }) }) }) }) };
  assert.equal((await lerCardapioExperience({ db: comErro, unidadeId: "seldeestrela" })).status, 503);
  const semLoja = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
  assert.equal((await lerCardapioExperience({ db: semLoja, unidadeId: "outra" })).status, 404, "loja desconhecida não vira Seldeestrela");
});

test("lancarPedidoMesaExperience - sem banco não diz que enviou; mesa desconhecida não é criada", async () => {
  const semBanco = await lancarPedidoMesaExperience({ db: null, unidadeId: "seldeestrela", mesaNumero: "4", itens: [{ id: "p1", quantidade: 1 }] });
  assert.equal(semBanco.ok, false);
  let inseriuMesa = false;
  const db = {
    from: (t) => {
      assert.equal(t, "mesas");
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
        insert: () => { inseriuMesa = true; return { select: () => ({ single: async () => ({ data: { id: "x" }, error: null }) }) }; },
      };
    },
  };
  const r = await lancarPedidoMesaExperience({ db, unidadeId: "seldeestrela", mesaNumero: "999", itens: [{ id: "p1", quantidade: 1 }] });
  assert.equal(r.status, 404);
  assert.equal(inseriuMesa, false);
});

test("criarChamadoGarcomExperience - sem gravar, não diz que o garçom foi avisado", async () => {
  assert.equal((await criarChamadoGarcomExperience({ db: null, unidadeId: "seldeestrela", mesaNumero: "4", tipo: "garcom" })).ok, false);
  const db = {
    from: (t) => (t === "mesas"
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }
      : { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'relation "experience_chamados" does not exist' } }) }) }) }),
  };
  const r = await criarChamadoGarcomExperience({ db, unidadeId: "seldeestrela", mesaNumero: "4", tipo: "garcom" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
});
