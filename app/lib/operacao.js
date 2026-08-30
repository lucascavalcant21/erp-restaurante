import { supabase, isSupabaseReady } from "./supabase";
import { calcularPrecoNormalizado } from "./ingredientes-utils.mjs";
import { estoquePrincipalDoSetor } from "./estoques-multiplos-utils.mjs";

// ─── INSUMOS (Ingredientes Brutos) ──────────────────────────────────────────

export async function fetchInsumos(unidadeId, dept, opcoes = {}) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  let query = supabase.from("insumos").select("*");
  if (unidadeId && (opcoes?.escopoEstrito === true || unidadeId !== "matriz")) query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);

  const { data, error } = await query;
  if (error || !data?.length) return { data: data || [], error: error?.message };

  // A tabela de vínculo foi adicionada depois do cadastro original. Se a
  // migração ainda não tiver sido aplicada, a listagem continua funcionando
  // com o fornecedor textual legado.
  const ids = data.map(item => item.id);
  const { data: vinculos, error: erroVinculos } = await supabase
    .from("insumos_fornecedores")
    .select("insumo_id, fornecedor_id, fornecedor:fornecedores(id,nome)")
    .in("insumo_id", ids);
  if (erroVinculos) return { data, error: null };

  const porInsumo = new Map();
  for (const vinculo of vinculos || []) {
    const fornecedor = Array.isArray(vinculo.fornecedor) ? vinculo.fornecedor[0] : vinculo.fornecedor;
    if (!fornecedor) continue;
    if (!porInsumo.has(vinculo.insumo_id)) porInsumo.set(vinculo.insumo_id, []);
    porInsumo.get(vinculo.insumo_id).push(fornecedor);
  }
  return {
    data: data.map(item => ({
      ...item,
      fornecedores_vinculados: porInsumo.get(item.id) || (item.fornecedor ? [{ nome: item.fornecedor }] : []),
    })),
    error: null,
  };
}

// Se o banco reclamar de uma coluna ainda não criada (ex: categoria, frete,
// preco_atualizado_em), remove essa coluna do payload e tenta de novo — assim
// o cadastro nunca quebra por falta de migração.
async function retrySemColunaAusente(error, tentar, campos, tentativas = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"?(?: of relation "[a-z_]+")? does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && tentativas < 30) {
    const col = match[1];
    if (col in campos) { delete campos[col]; return retrySemColunaAusente(await tentar(), tentar, campos, tentativas + 1); }
  }
  return error;
}

async function inserirHistoricoPreco(registro) {
  const campos = { ...registro };
  let resposta = await supabase.from("insumos_precos_historico").insert([campos]);
  const error = await retrySemColunaAusente(resposta.error, async () => {
    resposta = await supabase.from("insumos_precos_historico").insert([campos]);
    return resposta.error;
  }, campos);
  return error;
}

async function sincronizarFornecedores(insumoId, fornecedorIds = []) {
  if (!insumoId || !Array.isArray(fornecedorIds)) return;
  const ids = [...new Set(fornecedorIds.filter(Boolean))];
  const exclusao = await supabase.from("insumos_fornecedores").delete().eq("insumo_id", insumoId);
  if (exclusao.error || ids.length === 0) return;
  await supabase.from("insumos_fornecedores").insert(ids.map(fornecedor_id => ({
    insumo_id: insumoId,
    fornecedor_id,
  })));
}

function registroHistorico({ atual, campos, insumoId, usuario, origem, inicial = false }) {
  const anterior = atual || {};
  const combinado = { ...anterior, ...campos };
  const valorAnterior = inicial ? null : Number(anterior.custo_compra ?? anterior.custo_unitario) || 0;
  const valorNovo = Number(combinado.custo_compra ?? combinado.custo_unitario) || 0;
  const normalizadoAnterior = inicial ? null : (
    Number(anterior.preco_normalizado)
    || calcularPrecoNormalizado(
      Number(anterior.tamanho_embalagem) || 1,
      anterior.unidade_medida,
      valorAnterior,
    )
  );
  const normalizadoNovo = Number(combinado.preco_normalizado)
    || calcularPrecoNormalizado(
      Number(combinado.tamanho_embalagem) || 1,
      combinado.unidade_medida,
      valorNovo,
    );
  const diferenca = normalizadoAnterior === null ? null : normalizadoNovo - normalizadoAnterior;
  const percentual = normalizadoAnterior > 0 ? (diferenca / normalizadoAnterior) * 100 : null;

  return {
    unidade_id: combinado.unidade_id,
    insumo_id: insumoId,
    insumo_nome: combinado.nome,
    fornecedor_id: combinado.fornecedor_atual_id || null,
    fornecedor_nome: combinado.fornecedor || null,
    embalagem_quantidade_anterior: inicial ? null : Number(anterior.tamanho_embalagem) || 1,
    embalagem_unidade_anterior: inicial ? null : anterior.unidade_medida,
    embalagem_quantidade_nova: Number(combinado.tamanho_embalagem) || 1,
    embalagem_unidade_nova: combinado.unidade_medida,
    valor_anterior: valorAnterior,
    valor_novo: valorNovo,
    preco_normalizado_anterior: normalizadoAnterior,
    preco_normalizado_novo: normalizadoNovo,
    diferenca_valor: diferenca,
    diferenca_percentual: percentual,
    custo_anterior: normalizadoAnterior,
    custo_novo: normalizadoNovo,
    usuario_id: usuario?.id || null,
    usuario_nome: usuario?.user_metadata?.nome || usuario?.email || "Usuário do sistema",
    origem: origem || "Cadastro de ingredientes",
  };
}

export async function salvarInsumo(insumo, opcoes = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };

  // Remove campos que não devem ir no payload: `id` nulo quebra o INSERT
  // (coluna id é NOT NULL com default gen_random_uuid; enviar null viola a constraint)
  // e `created_at` é gerenciado pelo banco.
  const {
    id,
    created_at,
    updated_at,
    fornecedores_vinculados,
    fornecedor_ids = [],
    ...campos
  } = insumo;
  const fornecedorIds = [...new Set([
    ...fornecedor_ids,
    campos.fornecedor_atual_id,
  ].filter(Boolean))];
  const { data: authData } = await supabase.auth.getUser();
  const usuario = authData?.user || null;

  if (id) {
    // Preço mudou? Grava no histórico e carimba a data da atualização.
    try {
      const { data: atual } = await supabase.from("insumos").select("*").eq("id", id).single();
      const valorAntigo = Number(atual?.custo_compra ?? atual?.custo_unitario) || 0;
      const valorNovo = Number(campos.custo_compra ?? campos.custo_unitario) || 0;
      const embalagemMudou = Number(atual?.tamanho_embalagem || 1) !== Number(campos.tamanho_embalagem ?? atual?.tamanho_embalagem ?? 1)
        || String(atual?.unidade_medida || "") !== String(campos.unidade_medida ?? atual?.unidade_medida ?? "");
      if (atual && (Math.abs(valorAntigo - valorNovo) > 0.0001 || embalagemMudou)) {
        const historico = registroHistorico({
          atual,
          campos,
          insumoId: id,
          usuario,
          origem: opcoes.origem,
        });
        campos.preco_atualizado_em = new Date().toISOString();
        campos.preco_normalizado = historico.preco_normalizado_novo;
        campos.preco_normalizado_anterior = historico.preco_normalizado_anterior;
        campos.variacao_preco_pct = historico.diferenca_percentual;
        await inserirHistoricoPreco(historico);
      }
    } catch { /* histórico é acessório */ }
    let { error } = await supabase.from("insumos").update(campos).eq("id", id);
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("insumos").update(campos).eq("id", id); return r.error;
    }, campos);
    if (!error) await sincronizarFornecedores(id, fornecedorIds);
    return { id, error: error?.message };
  } else {
    // Trava de duplicidade: não permite dois ingredientes com o mesmo nome no
    // mesmo setor/unidade. Para outro preço, edite o existente e adicione um
    // fornecedor. Comparação sem acento e sem caixa.
    try {
      const norm = s => {
        const d = String(s || "").normalize("NFD");
        let out = "";
        for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
        return out.trim().toLowerCase();
      };
      const nomeNorm = norm(campos.nome);
      if (nomeNorm) {
        let q = supabase.from("insumos").select("id, nome, departamento, unidade_id");
        if (campos.unidade_id) q = q.eq("unidade_id", campos.unidade_id);
        if (campos.departamento) q = q.eq("departamento", campos.departamento);
        const { data: existentes } = await q.ilike("nome", String(campos.nome || "").trim());
        if ((existentes || []).some(e => norm(e.nome) === nomeNorm)) {
          return { error: "Já existe um ingrediente com esse nome neste setor. Edite o existente para adicionar outro fornecedor ou preço." };
        }
      }
    } catch { /* falha na checagem não bloqueia o cadastro */ }
    const normalizado = Number(campos.preco_normalizado) || calcularPrecoNormalizado(
      Number(campos.tamanho_embalagem) || 1,
      campos.unidade_medida,
      Number(campos.custo_compra ?? campos.custo_unitario) || 0,
    );
    campos.preco_normalizado = normalizado;
    campos.preco_normalizado_anterior = null;
    campos.variacao_preco_pct = null;
    campos.preco_atualizado_em = new Date().toISOString();
    let res = await supabase.from("insumos").insert([campos]).select("id").single();
    let data = res.data, error = res.error;
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("insumos").insert([campos]).select("id").single(); data = r.data; return r.error;
    }, campos);

    // Registro inicial no histórico de preços e criação automática no Estoque
    if (data?.id) {
      try {
        await inserirHistoricoPreco(registroHistorico({
          atual: null,
          campos,
          insumoId: data.id,
          usuario,
          origem: opcoes.origem,
          inicial: true,
        }));
        await sincronizarFornecedores(data.id, fornecedorIds);
      } catch { /* histórico é acessório */ }

      // Garante que o ingrediente/produto apareça imediatamente no Estoque com saldo 0
      try {
        if (campos.unidade_id) {
          await supabase.from("estoque_atual").upsert({
            unidade_id: campos.unidade_id,
            insumo_id: data.id,
            quantidade_atual: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: "unidade_id,insumo_id" });

          // Coloca o produto na prateleira do setor dele (Bar, Cozinha...).
          //
          // Duas coisas quebravam aqui e o produto do bar nunca chegava ao
          // estoque do bar:
          //
          // 1. O `.catch()` no fim do upsert. O que o supabase devolve é um
          //    "thenable" — tem `then`, não tem `catch`. Chamar `.catch()`
          //    estourava um TypeError ANTES de a requisição sair, e o try
          //    de fora engolia tudo num console.warn. O vínculo jamais era
          //    gravado, sem nenhum erro na tela.
          //
          // 2. O `|| ests[0]`. Sem estoque do setor, o produto era jogado no
          //    primeiro estoque que o banco devolvesse — a cerveja aparecia
          //    na cozinha. E como a busca era por "bar" no nome, ela também
          //    casava com "Pré-preparos do Bar" e "Embalagens do Bar".
          //    Agora quem escolhe é estoquePrincipalDoSetor, e não achando o
          //    estoque certo o produto fica sem vínculo em vez de ir para o
          //    lugar errado.
          //
          // 3. Pré-preparo tem casa própria. Quem cria a partir de uma ficha
          //    técnica avisa aqui e vincula ele mesmo ao "Pré-preparos do
          //    Bar/Cozinha"; sem isso o item entraria nos dois estoques e o
          //    mesmo saldo seria contado duas vezes.
          const { data: ests } = opcoes.semVinculoAutomatico
            ? { data: [] }
            : await supabase
              .from("estoques").select("id, slug, nome")
              .eq("unidade_id", campos.unidade_id);
          const alvo = estoquePrincipalDoSetor(ests, campos.departamento);
          if (alvo?.id) {
            const { error: erroVinculo } = await supabase.from("estoque_itens").upsert({
              unidade_id: campos.unidade_id,
              estoque_id: alvo.id,
              insumo_id: data.id,
              quantidade_atual: 0,
              updated_at: new Date().toISOString(),
            }, { onConflict: "estoque_id,insumo_id" });
            if (erroVinculo) console.warn("Aviso ao vincular novo ingrediente ao estoque:", erroVinculo.message);
          }
        }
      } catch (e) {
        console.warn("Aviso ao vincular novo ingrediente ao estoque:", e);
      }
    }
    return { id: data?.id, error: error?.message };
  }
}

// Histórico de preços dos insumos (todas as alterações, mais recentes primeiro)
export async function fetchHistoricoPrecos(unidadeId, insumoId = null) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  let q = supabase.from("insumos_precos_historico")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("created_at", { ascending: false })
    .limit(400);
  if (insumoId) q = q.eq("insumo_id", insumoId);
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function removerInsumo(id) {
  if (!isSupabaseReady()) return { error: "Offline" };

  try {
    // 1. Remover vínculos do módulo de múltiplos estoques e movimentações
    await supabase.from("estoque_itens").delete().eq("insumo_id", id);
    await supabase.from("estoque_movimentacoes_multi").delete().eq("insumo_id", id);
  } catch (e) {
    console.warn("Aviso ao desvincular de estoques múltiplos:", e);
  }

  try {
    // 2. Desvincular/remover das fichas técnicas (fichas_ingredientes e ficha_itens)
    await supabase.from("ficha_itens").delete().eq("ingrediente_id", id);
    await supabase.from("ficha_itens").delete().eq("insumo_id", id);
    await supabase.from("fichas_ingredientes").delete().eq("ingrediente_id", id);
    await supabase.from("fichas_ingredientes").delete().eq("insumo_id", id);
  } catch (e) {
    console.warn("Aviso ao desvincular de fichas:", e);
  }

  try {
    // 3. Remover vínculos e históricos de fornecedores e preços
    await supabase.from("insumos_fornecedores").delete().eq("insumo_id", id);
    await supabase.from("insumos_precos_historico").delete().eq("insumo_id", id);
    await supabase.from("insumos_precos_fornecedores").delete().eq("insumo_id", id);
  } catch (e) {
    console.warn("Aviso ao remover dados secundários:", e);
  }

  try {
    // 4. Remover do estoque e movimentações legadas
    await supabase.from("estoque").delete().eq("insumo_id", id);
    await supabase.from("estoque_movimentacoes").delete().eq("insumo_id", id);
  } catch (e) {
    console.warn("Aviso ao remover estoque legado:", e);
  }

  // 5. Excluir do catálogo principal
  const { error } = await supabase.from("insumos").delete().eq("id", id);

  // Fallback: se houver qualquer outra constraint de chave estrangeira no Postgres,
  // identifica a tabela filha informada no erro e limpa dinamicamente.
  if (error && error.code === "23503") {
    const details = error.details || error.message || "";
    const match = details.match(/table "([a-z_]+)"/i);
    if (match && match[1]) {
      const tabelaFilha = match[1];
      try {
        await supabase.from(tabelaFilha).delete().eq("insumo_id", id);
        await supabase.from(tabelaFilha).delete().eq("ingrediente_id", id);
        const retry = await supabase.from("insumos").delete().eq("id", id);
        return { error: retry.error?.message || null };
      } catch {}
    }
  }

  return { error: error?.message || null };
}

// ─── FICHAS TÉCNICAS (Receitas) ──────────────────────────────────────────────

export async function fetchFichas(unidadeId, dept) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  
  // Select aninhado: `*` nos ingredientes traz colunas novas (ex: fator_correcao)
  // sem quebrar quando a migração ainda não rodou.
  let query = supabase.from("fichas_tecnicas")
    .select(`
      *,
      fichas_ingredientes!ficha_id(
        *,
        insumos(*)
      )
    `)
    .order("nome_receita");

  if (unidadeId && unidadeId !== "matriz") query = query.eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);
  query = query.eq("ativo", true);

  let { data, error } = await query;
  // Compatibilidade durante a publicação: se a migração de inativação ainda
  // estiver propagando, a tela continua listando as fichas normalmente.
  if (error && /ativo/i.test(error.message || "")) {
    let fallback = supabase.from("fichas_tecnicas")
      .select(`
        *,
        fichas_ingredientes!ficha_id(
          *,
          insumos(*)
        )
      `)
      .order("nome_receita");
    if (unidadeId && unidadeId !== "matriz") fallback = fallback.eq("unidade_id", unidadeId);
    if (dept) fallback = fallback.eq("departamento", dept);
    const resposta = await fallback;
    data = resposta.data;
    error = resposta.error;
  }
  return { data: data || [], error: error?.message };
}

// Nomes dos pratos e drinks que são montados na hora do pedido.
// Servem para manter a contagem de estoque limpa: o que sai pronto da cozinha
// ou do balcão não é coisa que se guarda e se conta — quem tem saldo é o
// ingrediente e o pré-preparo. Ficam de fora desta lista, de propósito:
//  · eh_base = pré-preparo, que tem estoque próprio e é contado lá;
//  · tipo_base 'produto_pronto' = comprado pronto (cerveja, refrigerante),
//    que é estoque de verdade e precisa continuar aparecendo.
// Nomes do que é comprado pronto (cerveja, refrigerante, bombom). Não tem
// receita nem montagem: entra no estoque e sai vendido do jeito que chegou.
// Serve para tirar esses itens do guia de montagem e do receituário.
export async function fetchNomesDeProdutosProntos(unidadeId, dept = "") {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let query = supabase.from("fichas_tecnicas")
    .select("nome_receita, eh_base, tipo_base").eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || [])
      .filter(f => !f.eh_base && f.tipo_base === "produto_pronto")
      .map(f => String(f.nome_receita || "").trim().toLowerCase())
      .filter(Boolean),
  };
}

export async function fetchNomesDePratosEDrinks(unidadeId, dept = "") {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let query = supabase.from("fichas_tecnicas")
    .select("nome_receita, eh_base, tipo_base").eq("unidade_id", unidadeId);
  if (dept) query = query.eq("departamento", dept);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || [])
      .filter(f => !f.eh_base && f.tipo_base !== "produto_pronto")
      .map(f => String(f.nome_receita || "").trim().toLowerCase())
      .filter(Boolean),
  };
}

// A mensagem crua do Postgres ("violates foreign key constraint
// fichas_tecnicas_unidade_id_fkey") não diz a ninguém o que fazer. A causa é
// sempre a mesma: a unidade que a tela mandou não existe na tabela `unidades`.
function erroDeUnidade(mensagem, unidadeId) {
  if (!/foreign key/i.test(mensagem || "") || !/unidade/i.test(mensagem || "")) return null;
  return `A unidade "${unidadeId || "(vazia)"}" não está cadastrada em Unidades, então a ficha não pode ser gravada nela. `
    + "Recarregue a página e confirme a loja selecionada no topo; se o aviso continuar, a unidade precisa ser cadastrada.";
}

export async function salvarFicha(ficha, ingredientes) {
  if (!isSupabaseReady()) return { error: "Offline" };

  // Sem unidade de verdade não dá para gravar. "matriz" e "todas" são curingas
  // de LEITURA ("não filtre por unidade") — gravar com eles estoura a chave
  // estrangeira ou arquiva a ficha numa unidade que não existe.
  const unidade = String(ficha?.unidade_id || "").trim();
  if (!unidade || unidade === "todas" || unidade === "matriz") {
    return { error: "Escolha a loja no topo da tela antes de salvar a ficha." };
  }

  let fichaId = ficha.id;
  // `id` nulo quebra o INSERT (mesma constraint NOT NULL da tabela insumos)
  const { id: _id, created_at, ...camposFicha } = ficha;

  // 1. Salva a Capa da Ficha (retry tira colunas ainda não migradas: categoria, ordem)
  if (fichaId) {
    let { error } = await supabase.from("fichas_tecnicas").update(camposFicha).eq("id", fichaId);
    error = await retrySemColunaAusente(error, async () => {
      const r = await supabase.from("fichas_tecnicas").update(camposFicha).eq("id", fichaId); return r.error;
    }, camposFicha);
    if(error) return { error: erroDeUnidade(error.message, unidade) || error.message };
  } else {
    let res = await supabase.from("fichas_tecnicas").insert([camposFicha]).select("id").single();
    let error = await retrySemColunaAusente(res.error, async () => {
      const r = await supabase.from("fichas_tecnicas").insert([camposFicha]).select("id").single(); res = r; return r.error;
    }, camposFicha);
    if(error) return { error: erroDeUnidade(error.message, unidade) || error.message };
    fichaId = res.data.id;
  }

  // 2. Substitui os ingredientes. Guarda uma cópia antes de apagar para que
  // uma falha de banco nunca deixe uma ficha existente vazia pela metade.
  const { data: ingredientesAnteriores } = await supabase.from("fichas_ingredientes").select("*").eq("ficha_id", fichaId);
  const { error: erroExclusaoIngredientes } = await supabase.from("fichas_ingredientes").delete().eq("ficha_id", fichaId);
  if (erroExclusaoIngredientes) return { error: `Não foi possível atualizar os ingredientes: ${erroExclusaoIngredientes.message}` };
  
  if (ingredientes && ingredientes.length > 0) {
    const itens = ingredientes.map(i => ({
      ficha_id: fichaId,
      insumo_id: i.insumo_id || null,
      subficha_id: i.subficha_id || null,
      quantidade: i.quantidade,
      fator_correcao: Number(i.fator_correcao) || 0,
    }));
    let { error: errItens } = await supabase.from("fichas_ingredientes").insert(itens);
    // Coluna fator_correcao ainda não migrada? Regrava sem ela (não perde a ficha)
    if (errItens && /fator_correcao/i.test(errItens.message || "")) {
      const retry = await supabase.from("fichas_ingredientes").insert(itens.map(({ fator_correcao, ...resto }) => resto));
      errItens = retry.error;
    }
    if (errItens) {
      if (ingredientesAnteriores?.length) {
        const restaurar = ingredientesAnteriores.map(({ id, created_at, updated_at, ...item }) => item);
        await supabase.from("fichas_ingredientes").insert(restaurar);
      }
      return { error: `Não foi possível salvar os ingredientes: ${errItens.message}` };
    }
  }

  // Sincronização automática com o Guia de Montagem
  try {
    if (!ficha.eh_base && ficha.tipo_base !== "produto_pronto") {
      await sincronizarFichaComMontagem({ ...ficha, id: fichaId }, ingredientes);
    }
  } catch (errSync) {
    console.error("[salvarFicha] Erro ao sincronizar com Guia de Montagem:", errSync);
  }

  return { success: true, id: fichaId };
}

export async function sincronizarFichaComMontagem(ficha, ingredientes) {
  if (!isSupabaseReady()) return;
  const nome = String(ficha.nome_receita || ficha.nome || "").trim();
  if (!nome) return;

  const deptLower = String(ficha.departamento || ficha.tipo_base || "").toLowerCase();
  const departamento = deptLower.includes("bar") || deptLower.includes("drink") ? "bar" : "cozinha";
  const tipo = departamento === "bar" ? "drink" : "prato";
  const unidadeId = ficha.unidade_id || null;

  let nomesIngredientes = [];
  if (Array.isArray(ingredientes) && ingredientes.length > 0) {
    const insumoIds = ingredientes.map(i => i.insumo_id).filter(Boolean);
    const mapaInsumos = new Map();
    if (insumoIds.length > 0) {
      const { data: ins } = await supabase.from("insumos").select("id, nome, unidade_medida").in("id", insumoIds);
      (ins || []).forEach(item => mapaInsumos.set(item.id, item));
    }

    nomesIngredientes = ingredientes.map(i => {
      const insumo = mapaInsumos.get(i.insumo_id);
      const nomeIng = i.nome || insumo?.nome || "Ingrediente";
      const un = i.unidade_medida || insumo?.unidade_medida || "un";
      const qtd = i.quantidade != null && i.quantidade !== "" ? i.quantidade : "";
      return `• ${nomeIng}${qtd !== "" ? `: ${qtd} ${un}` : ""}`;
    });
  }

  const passosModo = ficha.modo_preparo || ficha.preparo || ficha.descritivo || "";
  const blocoIngredientes = nomesIngredientes.length > 0 ? `Ingredientes:\n${nomesIngredientes.join("\n")}` : "";

  const descritivoCompleto = [passosModo, blocoIngredientes].filter(Boolean).join("\n\n");

  const rendimentoStr = ficha.rendimento_porcoes
    ? `${ficha.rendimento_porcoes} ${ficha.rendimento_unidade || "porção(ões)"}`
    : (ficha.rendimento || null);

  const payloadMontagem = {
    nome,
    tipo,
    departamento,
    descritivo: descritivoCompleto || null,
    foto_url: ficha.foto_url || null,
    tempo_preparo: Number(ficha.tempo_preparo) || null,
    rendimento: rendimentoStr,
    observacoes: ficha.observacoes || null,
    unidade_id: unidadeId,
    updated_at: new Date().toISOString(),
  };

  let query = supabase.from("montagem").select("id").eq("nome", nome);
  if (unidadeId) query = query.eq("unidade_id", unidadeId);
  const { data: existente } = await query.maybeSingle();

  if (existente?.id) {
    await supabase.from("montagem").update(payloadMontagem).eq("id", existente.id);
  } else {
    await supabase.from("montagem").insert([payloadMontagem]);
  }
}

// Atualiza só o custo por unidade de um insumo (usado no "Recalcular custos").
export async function atualizarCustoUnitario(id, custo_unitario) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("insumos").update({ custo_unitario }).eq("id", id);
  return { error: error?.message };
}

export async function removerFicha(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("fichas_tecnicas").delete().eq("id", id);
  return { error: error?.message };
}

// O nome da ficha-mãe entra junto: "Utilizada como componente" não dizia POR
// QUEM, e é essa receita que perde o ingrediente se a exclusão for forçada.
//
// O embed do PostgREST depende do nome da chave estrangeira. Se ele não casar,
// a consulta inteira falharia e a tela bloquearia a exclusão por "verificação
// incompleta" — pior do que antes. Por isso o fallback: sem o nome, mas sem
// travar nada.
async function referenciasComNome(ids) {
  const comNome = await supabase.from("fichas_ingredientes")
    .select("ficha_id,subficha_id,fichas_tecnicas!ficha_id(nome_receita)")
    .in("subficha_id", ids);
  if (!comNome.error) return comNome;
  return supabase.from("fichas_ingredientes").select("ficha_id,subficha_id").in("subficha_id", ids);
}

export async function verificarDependenciasFichas(fichas, unidadeId) {
  if (!isSupabaseReady()) return { porFicha: {}, error: "Offline" };
  const lista = (fichas || []).filter(item => item?.id);
  const ids = lista.map(item => item.id);
  const nomes = lista.map(item => item.nome_receita).filter(Boolean);
  const porFicha = Object.fromEntries(ids.map(id => [id, []]));
  if (!ids.length) return { porFicha, error: null };

  const limitarUnidade = query => unidadeId && unidadeId !== "matriz" ? query.eq("unidade_id", unidadeId) : query;
  const [produtos, referencias, producoes, montagens] = await Promise.all([
    limitarUnidade(supabase.from("produtos").select("id,nome_produto,ficha_id").in("ficha_id", ids)),
    referenciasComNome(ids),
    limitarUnidade(supabase.from("producao_diaria").select("id,ficha_id").in("ficha_id", ids)),
    nomes.length
      ? limitarUnidade(supabase.from("montagem").select("id,nome").in("nome", nomes))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const adicionar = (id, tipo, nome) => {
    if (!id || !porFicha[id]) return;
    const rotulo = { tipo, nome: nome || tipo };
    if (porFicha[id].some(item => item.tipo === rotulo.tipo && item.nome === rotulo.nome)) return;
    porFicha[id].push(rotulo);
  };
  for (const item of produtos.data || []) adicionar(item.ficha_id, "Produto do cardápio", item.nome_produto);
  for (const item of referencias.data || []) {
    const mae = item.fichas_tecnicas?.nome_receita;
    adicionar(item.subficha_id, "Outra ficha técnica", mae ? `Ingrediente de: ${mae}` : "Utilizada como componente");
  }
  for (const item of producoes.data || []) adicionar(item.ficha_id, "Histórico de produção", "Registro de produção existente");
  const fichaPorNome = new Map(lista.map(item => [String(item.nome_receita || "").trim().toLocaleLowerCase("pt-BR"), item.id]));
  for (const item of montagens.data || []) {
    adicionar(fichaPorNome.get(String(item.nome || "").trim().toLocaleLowerCase("pt-BR")), "Guia de montagem", item.nome);
  }

  return {
    porFicha,
    avisos: [produtos.error, referencias.error, producoes.error, montagens.error]
      .filter(Boolean).map(error => error.message),
    error: null,
  };
}

export async function registrarAuditoriaFichas({
  unidadeId,
  usuarioId = null,
  usuarioNome = "",
  acao,
  fichas,
  origem = "Tela de fichas técnicas",
  detalhes = {},
}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const lista = (fichas || []).filter(Boolean);
  const { error } = await supabase.from("fichas_lote_auditoria").insert([{
    unidade_id: unidadeId,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome || null,
    acao,
    ficha_ids: lista.map(item => item.id),
    ficha_nomes: lista.map(item => item.nome_receita),
    quantidade: lista.length,
    origem,
    detalhes,
  }]);
  return { error: error?.message || null };
}

export async function excluirFichasLote(fichas, auditoria = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const lista = (fichas || []).filter(item => item?.id);
  if (!lista.length) return { error: "Nenhuma ficha para excluir." };
  const { error } = await supabase.from("fichas_tecnicas").delete().in("id", lista.map(item => item.id));
  if (error) return { error: error.message };
  await registrarAuditoriaFichas({ ...auditoria, acao: "exclusao", fichas: lista });
  return { error: null, quantidade: lista.length };
}

// Exclusão FORÇADA: apaga a ficha e leva junto os dois vínculos que a tela
// mostra — o produto do cardápio e o guia de montagem. É o "excluir mesmo
// assim", para quando a ficha foi criada errada e não há nada a preservar.
//
// O que NÃO é apagado aqui, de propósito:
//   - producao_diaria: é histórico do que a casa produziu, não um vínculo.
//   - fichas_ingredientes.subficha_id é APAGADO: essa ficha é ingrediente de
//     outra, e a receita-mãe perde essa linha. É perda de verdade, então a tela
//     nomeia as receitas afetadas na confirmação antes de chegar aqui.
//   - producao_diaria é PRESERVADO: a linha continua, só perde o ponteiro para
//     a ficha. Data, quantidade e quem produziu valem sem a receita; apagar
//     destruiria registro do que a casa produziu.
export async function excluirFichasComVinculos(fichas, auditoria = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const lista = (fichas || []).filter(item => item?.id);
  if (!lista.length) return { error: "Nenhuma ficha para excluir." };
  const ids = lista.map(item => item.id);
  const nomes = lista.map(item => item.nome_receita).filter(Boolean);
  const unidadeId = auditoria?.unidadeId;
  const limitarUnidade = query => unidadeId && unidadeId !== "matriz" ? query.eq("unidade_id", unidadeId) : query;

  // Vínculos primeiro: apagar a ficha antes deixaria produto e montagem
  // apontando para um id que não existe mais.
  const removidos = { produtos: 0, montagens: 0, componentes: 0, producoesDesvinculadas: 0 };
  const p = await limitarUnidade(supabase.from("produtos").delete().in("ficha_id", ids)).select("id");
  if (p.error) return { error: `Não consegui remover o produto do cardápio: ${p.error.message}` };
  removidos.produtos = (p.data || []).length;

  if (nomes.length) {
    const m = await limitarUnidade(supabase.from("montagem").delete().in("nome", nomes)).select("id");
    if (m.error) return { error: `Não consegui remover o guia de montagem: ${m.error.message}` };
    removidos.montagens = (m.data || []).length;
  }

  // A ficha usada como ingrediente de outra: some a linha da receita-mãe.
  const r = await supabase.from("fichas_ingredientes").delete().in("subficha_id", ids).select("id");
  if (r.error) return { error: `Não consegui tirar a ficha das receitas que a usam: ${r.error.message}` };
  removidos.componentes = (r.data || []).length;

  // Histórico de produção: a linha FICA, só perde o ponteiro para a ficha.
  // Apagar destruiria o registro do que a casa produziu — data, quantidade e
  // quem produziu continuam valendo mesmo sem a receita. Assim a chave
  // estrangeira solta sem custo nenhum de informação.
  const h = await supabase.from("producao_diaria").update({ ficha_id: null }).in("ficha_id", ids).select("id");
  if (h.error && !/violates not-null|null value/i.test(h.error.message || "")) {
    return { error: `Não consegui soltar o histórico de produção: ${h.error.message}` };
  }
  removidos.producoesDesvinculadas = (h.data || []).length;

  const { error } = await supabase.from("fichas_tecnicas").delete().in("id", ids);
  if (error) {
    const msg = error.message || "";
    if (/foreign key|violates/i.test(msg)) {
      // Nomear a tabela que segurou: "um dos dois" mandava procurar no escuro.
      // O Postgres cita duas tabelas: `on table "fichas_tecnicas" violates ...
      // on table "producao_diaria"`. A que segura é a ÚLTIMA; a primeira é a
      // que se tentou apagar.
      const citadas = [...msg.matchAll(/on table "([a-z_]+)"/gi)].map(m => m[1]);
      const tabela = citadas.length > 1 ? citadas[citadas.length - 1] : (citadas[0] || "");
      return {
        error: `Cardápio, guia, receitas que a usavam e histórico de produção já foram desvinculados, `
          + `mas a ficha continua presa${tabela ? ` a "${tabela}"` : ""}. `
          + `Esse vínculo não é apagado automaticamente porque não estava previsto: me mande esta `
          + `mensagem que eu trato. Enquanto isso, Inativar resolve. (${msg})`,
      };
    }
    return { error: msg };
  }

  await registrarAuditoriaFichas({ ...auditoria, acao: "exclusao_forcada", fichas: lista, detalhes: removidos });
  return { error: null, quantidade: lista.length, removidos };
}

export async function inativarFichasLote(fichas, auditoria = {}) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const lista = (fichas || []).filter(item => item?.id);
  if (!lista.length) return { error: "Nenhuma ficha para inativar." };
  const { error } = await supabase.from("fichas_tecnicas")
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .in("id", lista.map(item => item.id));
  if (error) return { error: error.message };
  await registrarAuditoriaFichas({ ...auditoria, acao: "inativacao", fichas: lista });
  return { error: null, quantidade: lista.length };
}

// Atualiza só a ordem de exibição (arrastar para reordenar). Se a coluna `ordem`
// ainda não existir, o retry a remove e a operação vira no-op silencioso.
export async function atualizarOrdemFicha(id, ordem) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const campos = { ordem };
  let { error } = await supabase.from("fichas_tecnicas").update(campos).eq("id", id);
  error = await retrySemColunaAusente(error, async () => {
    const r = await supabase.from("fichas_tecnicas").update(campos).eq("id", id); return r.error;
  }, campos);
  return { error: error?.message };
}
