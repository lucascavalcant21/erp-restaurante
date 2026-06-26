import { supabase, isSupabaseReady } from "./supabase";

const TEST_UNIT_NAME = "Hefisto - Ambiente de Teste";

export async function limparAmbienteTeste() {
  if (!isSupabaseReady()) return { error: "Offline" };

  try {
    // 1. Achar a unidade de teste
    const { data: unidade } = await supabase.from("unidades").select("id").eq("nome", TEST_UNIT_NAME).single();
    if (!unidade) return { success: true }; // Nada para limpar

    // 2. Apagar a Unidade.
    // Como a tabela tem ON DELETE CASCADE para quase tudo, isso limpará os pedidos, produtos, insumos, etc.
    const { error } = await supabase.from("unidades").delete().eq("id", unidade.id);
    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Erro ao limpar ambiente:", error);
    return { error: error.message };
  }
}

export async function gerarDadosFicticios() {
  if (!isSupabaseReady()) return { error: "Offline" };

  try {
    // 1. Limpar caso já exista para evitar duplicação
    await limparAmbienteTeste();

    // 2. Criar Unidade de Teste
    const { data: novaUnidade, error: errUni } = await supabase.from("unidades")
      .insert([{
        id: "mock-unidade",
        nome: TEST_UNIT_NAME,
        cor: "#8B5CF6", // Roxo para destacar
        delivery_aberto: true,
        taxa_entrega_padrao: 5.00,
        horario_funcionamento: "18:00 às 23:59",
        telefone_contato: "11999999999"
      }]).select("id").single();
    
    if (errUni) throw errUni;
    const uid = novaUnidade.id;

    // 3. Abrir um Caixa
    const { data: caixa } = await supabase.from("caixas")
      .insert([{
         unidade_id: uid,
         usuario_abertura_id: null,
         saldo_inicial: 150.00,
         saldo_atual: 150.00,
         status: "aberto"
      }]).select("id").single();

    // 4. Insumos
    const insumosSeed = [
      { nome: "Carne Bovina (Blend)", departamento: "cozinha", unidade_medida: "kg", custo_unitario: 35.00, unidade_id: uid },
      { nome: "Pão Brioche", departamento: "cozinha", unidade_medida: "un", custo_unitario: 1.50, unidade_id: uid },
      { nome: "Queijo Cheddar Fatiado", departamento: "cozinha", unidade_medida: "kg", custo_unitario: 45.00, unidade_id: uid },
      { nome: "Bacon em Tiras", departamento: "cozinha", unidade_medida: "kg", custo_unitario: 50.00, unidade_id: uid },
      { nome: "Barril Chopp Pilsen 50L", departamento: "bar", unidade_medida: "l", custo_unitario: 12.00, unidade_id: uid },
      { nome: "Vodka Smirnoff", departamento: "bar", unidade_medida: "l", custo_unitario: 40.00, unidade_id: uid },
      { nome: "Limão Taiti", departamento: "bar", unidade_medida: "kg", custo_unitario: 5.00, unidade_id: uid },
    ];
    const { data: insumos } = await supabase.from("insumos").insert(insumosSeed).select();

    // Funções auxiliares para achar IDs
    const getIns = (nome) => insumos.find(i => i.nome === nome).id;

    // 5. Estoque Inicial
    const estoqueSeed = insumos.map(i => ({
       unidade_id: uid,
       insumo_id: i.id,
       quantidade_atual: i.unidade_medida === 'kg' || i.unidade_medida === 'l' ? 10 : 100 // 10kg/10L ou 100un
    }));
    await supabase.from("estoque_atual").insert(estoqueSeed);

    // 6. Fichas Técnicas e Ingredientes
    // Smash Classic
    const { data: fichaSmash } = await supabase.from("fichas_tecnicas").insert([{
       unidade_id: uid, departamento: "cozinha", nome_receita: "Smash Classic"
    }]).select("id").single();
    await supabase.from("fichas_ingredientes").insert([
       { ficha_id: fichaSmash.id, insumo_id: getIns("Carne Bovina (Blend)"), quantidade: 0.150 },
       { ficha_id: fichaSmash.id, insumo_id: getIns("Pão Brioche"), quantidade: 1.000 },
       { ficha_id: fichaSmash.id, insumo_id: getIns("Queijo Cheddar Fatiado"), quantidade: 0.040 },
    ]);

    // Double Bacon
    const { data: fichaDouble } = await supabase.from("fichas_tecnicas").insert([{
       unidade_id: uid, departamento: "cozinha", nome_receita: "Double Bacon Smash"
    }]).select("id").single();
    await supabase.from("fichas_ingredientes").insert([
       { ficha_id: fichaDouble.id, insumo_id: getIns("Carne Bovina (Blend)"), quantidade: 0.300 },
       { ficha_id: fichaDouble.id, insumo_id: getIns("Pão Brioche"), quantidade: 1.000 },
       { ficha_id: fichaDouble.id, insumo_id: getIns("Queijo Cheddar Fatiado"), quantidade: 0.080 },
       { ficha_id: fichaDouble.id, insumo_id: getIns("Bacon em Tiras"), quantidade: 0.050 },
    ]);

    // Caipirinha
    const { data: fichaCaipi } = await supabase.from("fichas_tecnicas").insert([{
       unidade_id: uid, departamento: "bar", nome_receita: "Caipirinha Clássica"
    }]).select("id").single();
    await supabase.from("fichas_ingredientes").insert([
       { ficha_id: fichaCaipi.id, insumo_id: getIns("Vodka Smirnoff"), quantidade: 0.075 },
       { ficha_id: fichaCaipi.id, insumo_id: getIns("Limão Taiti"), quantidade: 0.100 },
    ]);

    // Chopp
    const { data: fichaChopp } = await supabase.from("fichas_tecnicas").insert([{
       unidade_id: uid, departamento: "bar", nome_receita: "Copo Chopp 500ml"
    }]).select("id").single();
    await supabase.from("fichas_ingredientes").insert([
       { ficha_id: fichaChopp.id, insumo_id: getIns("Barril Chopp Pilsen 50L"), quantidade: 0.500 },
    ]);

    // 7. Produtos
    const produtosSeed = [
       { unidade_id: uid, nome_produto: "Smash Classic", categoria: "Hambúrgueres", departamento: "cozinha", preco_venda: 28.00, ficha_id: fichaSmash.id, tempo_preparo_base: 10, descricao: "Pão, blend 150g, cheddar." },
       { unidade_id: uid, nome_produto: "Double Bacon", categoria: "Hambúrgueres", departamento: "cozinha", preco_venda: 39.00, ficha_id: fichaDouble.id, tempo_preparo_base: 15, descricao: "Pão, 2x blend 150g, duplo cheddar e bacon." },
       { unidade_id: uid, nome_produto: "Caipirinha", categoria: "Drinks", departamento: "bar", preco_venda: 22.00, ficha_id: fichaCaipi.id, tempo_preparo_base: 5, descricao: "Vodka, limão e açúcar." },
       { unidade_id: uid, nome_produto: "Chopp 500ml", categoria: "Bebidas", departamento: "bar", preco_venda: 15.00, ficha_id: fichaChopp.id, tempo_preparo_base: 3, descricao: "Chopp Pilsen gelado." },
    ];
    const { data: produtos } = await supabase.from("produtos").insert(produtosSeed).select();

    // 8. Mesas
    const mesasSeed = [
       { unidade_id: uid, numero_mesa: "01", status: "ocupada" },
       { unidade_id: uid, numero_mesa: "02", status: "livre" },
       { unidade_id: uid, numero_mesa: "03", status: "ocupada" },
    ];
    const { data: mesas } = await supabase.from("mesas").insert(mesasSeed).select();

    // 9. Pedidos (Mesa 01) - Em preparo
    const { data: ped1 } = await supabase.from("pedidos").insert([{
       unidade_id: uid, mesa_id: mesas[0].id, tipo_pedido: "mesa", status: "aberto"
    }]).select("id").single();
    await supabase.from("pedidos_itens").insert([
       { pedido_id: ped1.id, produto_id: produtos[0].id, quantidade: 1, valor_unitario: 28.00, status_kds: "preparando", observacao: "Sem cebola" },
       { pedido_id: ped1.id, produto_id: produtos[3].id, quantidade: 2, valor_unitario: 15.00, status_kds: "entregue" }, // Chopps já entregues
    ]);

    // 10. Pedido (Mesa 03) - Pendente (Acabou de pedir)
    const { data: ped2 } = await supabase.from("pedidos").insert([{
       unidade_id: uid, mesa_id: mesas[2].id, tipo_pedido: "mesa", status: "aberto"
    }]).select("id").single();
    await supabase.from("pedidos_itens").insert([
       { pedido_id: ped2.id, produto_id: produtos[1].id, quantidade: 2, valor_unitario: 39.00, status_kds: "pendente" },
       { pedido_id: ped2.id, produto_id: produtos[2].id, quantidade: 2, valor_unitario: 22.00, status_kds: "pendente" }, 
    ]);

    // 11. Pedido Balcão - Pago, aguardando na TV (Preparando)
    const { data: ped3 } = await supabase.from("pedidos").insert([{
       unidade_id: uid, tipo_pedido: "balcao", status: "pago", cliente_nome: "Maria", caixa_id: caixa.id
    }]).select("id").single();
    await supabase.from("pedidos_itens").insert([
       { pedido_id: ped3.id, produto_id: produtos[0].id, quantidade: 1, valor_unitario: 28.00, status_kds: "preparando", observacao: "#PARA LEVAR" },
    ]);

    // 12. Pedido Delivery (iFood Fake) - Pendente no KDS
    const { data: ped4 } = await supabase.from("pedidos").insert([{
       unidade_id: uid, tipo_pedido: "ifood", status: "preparando_delivery", cliente_nome: "João Silva", codigo_ifood: "9988"
    }]).select("id").single();
    await supabase.from("pedidos_itens").insert([
       { pedido_id: ped4.id, produto_id: produtos[1].id, quantidade: 1, valor_unitario: 39.00, status_kds: "pendente", observacao: "#DELIVERY" },
    ]);

    // 13. Lançamentos Financeiros (Custos Fixos) para o DRE
    const despesasSeed = [
       { unidade_id: uid, descricao: "Aluguel Loja", valor: 3500.00, tipo: "saida", categoria: "Aluguel", status: "pago", data: new Date().toISOString() },
       { unidade_id: uid, descricao: "Conta de Luz (Enel)", valor: 850.00, tipo: "saida", categoria: "Energia", status: "pago", data: new Date().toISOString() },
       { unidade_id: uid, descricao: "Folha de Pagamento (Garçons)", valor: 4200.00, tipo: "saida", categoria: "Folha de Pagamento", status: "pago", data: new Date().toISOString() },
       { unidade_id: uid, descricao: "Marketing (Instagram Ads)", valor: 300.00, tipo: "saida", categoria: "Marketing", status: "pago", data: new Date().toISOString() },
    ];
    await supabase.from("contas_pagar").insert(despesasSeed);

    // 14. Funcionários (RH) para testar o Ponto Eletrônico
    const rhSeed = [
       { unidade_id: uid, nome: "Carlos Chef", cargo: "Chefe de Cozinha", salario: 3500.00, tipo_contrato: "Fixo", status: "ativo", horario_entrada: "17:00", horario_saida: "01:00" },
       { unidade_id: uid, nome: "Ana Barman", cargo: "Bartender", salario: 2200.00, tipo_contrato: "Fixo", status: "ativo", horario_entrada: "18:00", horario_saida: "02:00" },
       { unidade_id: uid, nome: "Marcos Garçom", cargo: "Garçom", salario: 1800.00, tipo_contrato: "Fixo", status: "ativo", horario_entrada: "18:00", horario_saida: "02:00" },
    ];
    await supabase.from("colaboradores").insert(rhSeed);

    return { success: true, unidade_id: uid };
  } catch (error) {
    console.error("Erro na geração de mock:", error);
    return { error: error.message };
  }
}
