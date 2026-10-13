// ══════════════════════════════════════════════════════════════════════════════
// marmitaria-service.js — Camada de Serviços e Dados da Marmitaria & Delivery
// Integração resiliente com Supabase (multiunidade, multiempresa, offline-safe)
// ══════════════════════════════════════════════════════════════════════════════

import { supabase, isSupabaseReady } from '../supabase.js';
import { salvarProduto } from '../vendas.js';
import { fetchEstoques, vincularItemEstoque } from '../estoques-multiplos.js';
import { parseNumero } from '../ficha-calculos.mjs';

const erroTexto = (e) => e?.message || (typeof e === 'string' ? e : 'Erro inesperado');

function isTabelaAusente(e) {
  const m = erroTexto(e).toLowerCase();
  return m.includes('does not exist') || m.includes('could not find') || m.includes('schema cache') || m.includes('relation');
}

async function retrySemColunaAusente(error, tentar, campos, tentativas = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"?(?: of relation "[a-z_]+")? does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && tentativas < 30) {
    const col = match[1];
    if (col in campos) {
      delete campos[col];
      return retrySemColunaAusente(await tentar(), tentar, campos, tentativas + 1);
    }
  }
  return error;
}

// ─── 1. FICHAS TÉCNICAS DE MARMITAS ──────────────────────────────────────────

export async function fetchMarmitas(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    let query = supabase
      .from('fichas_tecnicas')
      .select(`
        *,
        fichas_ingredientes!ficha_id(
          *,
          insumos(id, nome, unidade_medida, custo_unitario, peso_medio_g, perda_pct, fator_correcao)
        )
      `)
      .eq('departamento', 'marmitaria');

    if (unidadeId && unidadeId !== 'matriz') {
      query = query.eq('unidade_id', unidadeId);
    }

    const { data: fichas, error } = await query.order('nome_receita');

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }

    // Carregar embalagens vinculadas a cada marmita
    const idsFichas = (fichas || []).map((f) => f.id);
    let embalagensMap = new Map();

    if (idsFichas.length > 0) {
      const { data: embData } = await supabase
        .from('marmitaria_fichas_embalagens')
        .select(`
          *,
          insumos:embalagem_insumo_id(id, nome, custo_unitario, unidade_medida)
        `)
        .in('ficha_id', idsFichas);

      if (embData) {
        for (const item of embData) {
          const lista = embalagensMap.get(item.ficha_id) || [];
          lista.push({
            id: item.id,
            embalagem_insumo_id: item.embalagem_insumo_id,
            nome: item.insumos?.nome || item.tipo_embalagem,
            tipo_embalagem: item.tipo_embalagem,
            quantidade: Number(item.quantidade) || 1,
            custo_unitario: Number(item.custo_unitario) || Number(item.insumos?.custo_unitario) || 0,
          });
          embalagensMap.set(item.ficha_id, lista);
        }
      }
    }

    const marmitasCompletas = (fichas || []).map((f) => ({
      ...f,
      embalagens: embalagensMap.get(f.id) || [],
      tamanho: f.tamanho_marmita || 'M',
      peso_final_g: f.peso_final_g || 500,
    }));

    return { data: marmitasCompletas, error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarMarmita(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    const {
      nome_receita,
      categoria = 'Marmitas',
      tamanho = 'M',
      peso_final_g = 500,
      tempo_preparo_min = 20,
      descricao_comercial = '',
      foto_url = '',
      custo_total = 0,
      preco_venda = 0,
      ingredientes = [],
      preparacoes = [],
      embalagens = [],
      montagem_passos = [],
      codigo = '',
    } = payload;

    // 1. Salvar ou atualizar ficha em `fichas_tecnicas`
    const dadosFicha = {
      unidade_id: unidadeId,
      nome_receita,
      categoria,
      departamento: 'marmitaria',
      tempo_preparo_min: Number(tempo_preparo_min) || 20,
      rendimento: 1,
      custo_total: Number(custo_total) || 0,
      foto_url: foto_url || null,
      codigo: codigo || null,
      peso_final_g: Number(peso_final_g) || 500,
      tamanho_marmita: tamanho,
      descricao_comercial,
      instrucoes_preparo: JSON.stringify(montagem_passos || []),
    };

    let fichaId = payload.id;
    if (isNovo) {
      let res = await supabase
        .from('fichas_tecnicas')
        .insert([dadosFicha])
        .select('id')
        .single();

      let errFicha = await retrySemColunaAusente(res.error, async () => {
        const r = await supabase.from('fichas_tecnicas').insert([dadosFicha]).select('id').single();
        res = r;
        return r.error;
      }, dadosFicha);

      if (errFicha) {
        // Fallback seguro: tenta inserir sem .select() e recupera id
        const r2 = await supabase.from('fichas_tecnicas').insert([dadosFicha]);
        if (r2.error) throw r2.error;
        const { data: rec } = await supabase
          .from('fichas_tecnicas')
          .select('id')
          .eq('nome_receita', nome_receita)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fichaId = rec?.id;
      } else {
        fichaId = res.data?.id;
      }
    } else {
      let errUpdate = await supabase
        .from('fichas_tecnicas')
        .update(dadosFicha)
        .eq('id', fichaId);

      errUpdate = await retrySemColunaAusente(errUpdate.error, async () => {
        const r = await supabase.from('fichas_tecnicas').update(dadosFicha).eq('id', fichaId);
        return r.error;
      }, dadosFicha);

      if (errUpdate) throw errUpdate;
    }

    // 2. Salvar ingredientes da ficha em `fichas_ingredientes`
    if (fichaId) {
      await supabase.from('fichas_ingredientes').delete().eq('ficha_id', fichaId);

      const todosIngredientes = [
        ...ingredientes.map((i, idx) => ({
          ficha_id: fichaId,
          insumo_id: i.insumo_id,
          quantidade: Number(i.quantidade) || 0,
          unidade_medida: i.unidade_medida || 'g',
          fator_correcao: Number(i.fator_correcao) || 1,
          custo_unitario: Number(i.custo_unitario) || 0,
          ordem: idx + 1,
        })),
        ...preparacoes.map((p, idx) => ({
          ficha_id: fichaId,
          insumo_id: p.insumo_id || null,
          subficha_id: p.subficha_id || p.id,
          quantidade: Number(p.quantidade) || 0,
          unidade_medida: p.unidade_medida || 'g',
          fator_correcao: 1,
          custo_unitario: Number(p.custo_unitario) || 0,
          ordem: ingredientes.length + idx + 1,
        })),
      ].filter((x) => x.insumo_id || x.subficha_id);

      if (todosIngredientes.length > 0) {
        await supabase.from('fichas_ingredientes').insert(todosIngredientes);
      }

      // 3. Salvar embalagens vinculadas em `marmitaria_fichas_embalagens`
      try {
        await supabase.from('marmitaria_fichas_embalagens').delete().eq('ficha_id', fichaId);
        if (embalagens && embalagens.length > 0) {
          const rowsEmb = embalagens.map((emb) => ({
            unidade_id: unidadeId,
            ficha_id: fichaId,
            embalagem_insumo_id: emb.embalagem_insumo_id || emb.insumo_id || null,
            tipo_embalagem: emb.tipo_embalagem || 'marmita',
            quantidade: Number(emb.quantidade) || 1,
            custo_unitario: Number(emb.custo_unitario) || 0,
          }));
          await supabase.from('marmitaria_fichas_embalagens').insert(rowsEmb);
        }
      } catch (errEmb) {
        console.warn('marmitaria_fichas_embalagens ainda pendente no schema:', errEmb.message);
      }

      // 4. Sincronizar com catálogo de produtos de venda (Cardápio / PDV / iFood)
      try {
        const preco = parseNumero(preco_venda);
        await salvarProduto({
          unidade_id: unidadeId,
          ficha_id: fichaId,
          nome_produto: nome_receita,
          preco_venda: preco,
          categoria: 'Marmitas',
          departamento: 'cozinha', // SalvarProduto valida 'cozinha' ou 'bar'
          observacoes: `Marmita tamanho ${tamanho} (${peso_final_g}g). ${descricao_comercial}`,
        });
      } catch (errProd) {
        console.warn('Erro ao sincronizar produto:', errProd.message);
      }
    }

    return { data: { id: fichaId }, error: null };
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

// ─── 2. PRÉ-PREPAROS & INSUMOS CENTRAIS (REUTILIZAÇÃO SEM DUPLICAÇÃO) ─────────

/**
 * Busca fichas de pré-preparo cadastradas no estoque central da cozinha (eh_base = true).
 * Permite que a Marmitaria reutilize arroz cozido, feijão, frango grelhado, purê etc.
 */
export async function fetchPreparacoesBase(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    let query = supabase
      .from('fichas_tecnicas')
      .select('id, nome_receita, categoria, rendimento, rendimento_unidade, custo_total, eh_base, departamento, tempo_preparo_min')
      .eq('eh_base', true);

    if (unidadeId && unidadeId !== 'matriz') {
      query = query.eq('unidade_id', unidadeId);
    }

    const { data, error } = await query.order('nome_receita');
    if (error) return { data: [], error: erroTexto(error) };

    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

/**
 * Cadastra ou atualiza uma ficha de pré-preparo (eh_base = true).
 */
export async function salvarPrePreparoMarmitaria(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    const dados = {
      unidade_id: unidadeId,
      nome_receita: payload.nome_receita,
      categoria: payload.categoria || 'Pré-preparo',
      departamento: payload.departamento || 'marmitaria',
      eh_base: true,
      rendimento: Number(payload.rendimento) || 1,
      rendimento_unidade: payload.rendimento_unidade || 'kg',
      custo_total: Number(payload.custo_total) || 0,
      tempo_preparo_min: Number(payload.tempo_preparo_min) || 30,
      instrucoes_preparo: payload.instrucoes_preparo || '',
    };

    let id = payload.id;
    if (isNovo) {
      let res = await supabase.from('fichas_tecnicas').insert([dados]).select('id').single();
      let err = await retrySemColunaAusente(res.error, async () => {
        const r = await supabase.from('fichas_tecnicas').insert([dados]).select('id').single();
        res = r;
        return r.error;
      }, dados);

      if (err) {
        // Fallback sem select
        const r2 = await supabase.from('fichas_tecnicas').insert([dados]);
        if (r2.error) throw r2.error;
        const { data: rec } = await supabase
          .from('fichas_tecnicas')
          .select('id')
          .eq('nome_receita', dados.nome_receita)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        id = rec?.id;
      } else {
        id = res.data?.id;
      }
    } else {
      let { error } = await supabase.from('fichas_tecnicas').update(dados).eq('id', id);
      error = await retrySemColunaAusente(error, async () => {
        const r = await supabase.from('fichas_tecnicas').update(dados).eq('id', id);
        return r.error;
      }, dados);
      if (error) throw error;
    }

    return { data: { id, ...dados }, error: null };
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

/**
 * Exclui uma ficha de pré-preparo
 */
export async function excluirPrePreparo(id) {
  if (!isSupabaseReady() || !id) return { error: 'Offline' };
  try {
    const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', id);
    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

/**
 * Busca matérias-primas e insumos com saldo de estoque atual.
 */
export async function fetchInsumosEstoque(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    let query = supabase
      .from('insumos')
      .select(`
        id,
        nome,
        categoria,
        departamento,
        unidade_medida,
        custo_unitario,
        custo_compra,
        perda_pct,
        fator_correcao,
        estoque_minimo,
        estoque_atual ( quantidade_atual )
      `)
      .order('nome');

    if (unidadeId && unidadeId !== 'matriz') {
      query = query.eq('unidade_id', unidadeId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: erroTexto(error) };

    const formatados = (data || []).map((ins) => ({
      ...ins,
      quantidade_atual: ins.estoque_atual?.[0]?.quantidade_atual ?? 0,
    }));

    return { data: formatados, error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

/**
 * Busca TODOS os insumos gerais do restaurante para possibilitar migração/seleção.
 */
export async function fetchTodosInsumosDoRestaurante(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    let query = supabase
      .from('insumos')
      .select(`
        id,
        nome,
        categoria,
        departamento,
        unidade_medida,
        custo_unitario,
        custo_compra,
        estoque_minimo,
        estoque_atual ( quantidade_atual )
      `)
      .order('nome');

    if (unidadeId && unidadeId !== 'matriz') {
      query = query.eq('unidade_id', unidadeId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: erroTexto(error) };

    const formatados = (data || []).map((ins) => ({
      ...ins,
      quantidade_atual: ins.estoque_atual?.[0]?.quantidade_atual ?? 0,
    }));

    return { data: formatados, error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

/**
 * Cadastra ou edita um insumo (alimentício ou de marmitaria).
 */
export async function salvarInsumoMarmitaria(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    const dados = {
      unidade_id: unidadeId,
      nome: payload.nome,
      categoria: payload.categoria || 'Proteínas',
      departamento: payload.departamento || 'marmitaria',
      unidade_medida: payload.unidade_medida || 'kg',
      custo_unitario: Number(payload.custo_unitario) || 0,
      custo_compra: Number(payload.custo_compra ?? payload.custo_unitario) || 0,
      estoque_minimo: payload.estoque_minimo !== undefined && payload.estoque_minimo !== '' ? Number(payload.estoque_minimo) : 5,
    };

    let id = payload.id;
    if (isNovo) {
      let res = await supabase.from('insumos').insert([dados]).select('id').single();
      let err = await retrySemColunaAusente(res.error, async () => {
        const r = await supabase.from('insumos').insert([dados]).select('id').single();
        res = r;
        return r.error;
      }, dados);

      if (err) {
        // Fallback sem select
        const r2 = await supabase.from('insumos').insert([dados]);
        if (r2.error) throw r2.error;
        const { data: rec } = await supabase
          .from('insumos')
          .select('id')
          .eq('nome', dados.nome)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        id = rec?.id;
      } else {
        id = res.data?.id;
      }
    } else {
      let { error } = await supabase.from('insumos').update(dados).eq('id', id);
      error = await retrySemColunaAusente(error, async () => {
        const r = await supabase.from('insumos').update(dados).eq('id', id);
        return r.error;
      }, dados);
      if (error) throw error;
    }

    // Atualiza saldo em estoque_atual se fornecido
    if (id && payload.quantidade_atual !== undefined && payload.quantidade_atual !== '') {
      try {
        const qtd = Number(payload.quantidade_atual) || 0;
        await supabase.from('estoque_atual').upsert(
          {
            insumo_id: id,
            unidade_id: unidadeId,
            quantidade_atual: qtd,
          },
          { onConflict: 'insumo_id' }
        );
      } catch (errEst) {
        console.warn('estoque_atual upsert aviso:', errEst.message);
      }
    }

    return { data: { id, ...dados }, error: null };
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

/**
 * Vincula / migra insumos existentes para a Marmitaria.
 */
export async function migrarInsumosParaMarmitaria(unidadeId, insumoIds = []) {
  if (!isSupabaseReady() || !unidadeId || !insumoIds.length) return { error: 'Nenhum insumo selecionado' };

  try {
    const { error } = await supabase
      .from('insumos')
      .update({ departamento: 'marmitaria' })
      .in('id', insumoIds);

    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

/**
 * Exclui um insumo
 */
export async function excluirInsumoMarmitaria(id) {
  if (!isSupabaseReady() || !id) return { error: 'Offline' };
  try {
    const { error } = await supabase.from('insumos').delete().eq('id', id);
    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

/**
 * Busca embalagens cadastradas no ERP com saldo de estoque.
 */
export async function fetchEmbalagensMarmitaria(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    // 1. Insumos com departamento = 'embalagens'
    let qInsumos = supabase
      .from('insumos')
      .select('id, nome, categoria, unidade_medida, custo_unitario, estoque_minimo, estoque_atual ( quantidade_atual )')
      .eq('departamento', 'embalagens');

    if (unidadeId && unidadeId !== 'matriz') {
      qInsumos = qInsumos.eq('unidade_id', unidadeId);
    }
    const { data: insumosEmb } = await qInsumos;

    // 2. Tabela operacao_embalagens (se existir)
    const { data: opEmb } = await supabase
      .from('operacao_embalagens')
      .select('id, nome, categoria, preco_unitario, insumo_id, departamento');

    const mapa = new Map();
    (insumosEmb || []).forEach((i) => {
      mapa.set(i.id, {
        id: i.id,
        insumo_id: i.id,
        nome: i.nome,
        categoria: i.categoria || 'Embalagens',
        custo_unitario: Number(i.custo_unitario) || 0,
        unidade_medida: i.unidade_medida || 'un',
        estoque_minimo: Number(i.estoque_minimo) || 20,
        quantidade_atual: i.estoque_atual?.[0]?.quantidade_atual ?? 50,
      });
    });

    (opEmb || []).forEach((e) => {
      const chave = e.insumo_id || e.id;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          id: chave,
          insumo_id: e.insumo_id || e.id,
          nome: e.nome,
          categoria: e.categoria || 'Embalagens',
          custo_unitario: Number(e.preco_unitario) || 0,
          unidade_medida: 'un',
          estoque_minimo: 20,
          quantidade_atual: 50,
        });
      }
    });

    return { data: [...mapa.values()], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

/**
 * Cadastra ou edita uma embalagem com preço de custo e estoque.
 */
export async function salvarEmbalagemMarmitaria(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    const custoUnitario = Number(payload.custo_unitario) || 0;
    const estoqueMinimo = Number(payload.estoque_minimo) || 20;
    const estoqueAtual = Number(payload.quantidade_atual ?? payload.estoque_atual) || 0;

    const dadosInsumo = {
      unidade_id: unidadeId,
      nome: payload.nome,
      categoria: payload.tipo_embalagem || payload.categoria || 'Embalagens',
      departamento: 'embalagens',
      unidade_medida: payload.unidade_medida || 'un',
      custo_unitario: custoUnitario,
      custo_compra: custoUnitario,
      estoque_minimo: estoqueMinimo,
    };

    let id = payload.id;
    if (isNovo) {
      let res = await supabase.from('insumos').insert([dadosInsumo]).select('id').single();
      let err = await retrySemColunaAusente(res.error, async () => {
        const r = await supabase.from('insumos').insert([dadosInsumo]).select('id').single();
        res = r;
        return r.error;
      }, dadosInsumo);

      if (err) {
        const r2 = await supabase.from('insumos').insert([dadosInsumo]);
        if (r2.error) throw r2.error;
        const { data: rec } = await supabase
          .from('insumos')
          .select('id')
          .eq('nome', dadosInsumo.nome)
          .eq('departamento', 'embalagens')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        id = rec?.id;
      } else {
        id = res.data?.id;
      }
    } else {
      let { error } = await supabase.from('insumos').update(dadosInsumo).eq('id', id);
      error = await retrySemColunaAusente(error, async () => {
        const r = await supabase.from('insumos').update(dadosInsumo).eq('id', id);
        return r.error;
      }, dadosInsumo);
      if (error) throw error;
    }

    // Atualiza saldo em estoque_atual
    if (id) {
      try {
        await supabase.from('estoque_atual').upsert(
          {
            insumo_id: id,
            unidade_id: unidadeId,
            quantidade_atual: estoqueAtual,
          },
          { onConflict: 'insumo_id' }
        );
      } catch (errEst) {
        console.warn('estoque_atual embalagem:', errEst.message);
      }
    }

    return { data: { id, ...dadosInsumo, quantidade_atual: estoqueAtual }, error: null };
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

/**
 * Atualiza rapidamente o saldo físico de uma embalagem
 */
export async function atualizarEstoqueEmbalagem(unidadeId, embalagemId, novaQuantidade) {
  if (!isSupabaseReady() || !unidadeId || !embalagemId) return { error: 'Offline' };

  try {
    const qtd = Number(novaQuantidade) || 0;
    const { error } = await supabase.from('estoque_atual').upsert(
      {
        insumo_id: embalagemId,
        unidade_id: unidadeId,
        quantidade_atual: qtd,
      },
      { onConflict: 'insumo_id' }
    );

    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

/**
 * Exclui uma embalagem
 */
export async function excluirEmbalagemMarmitaria(id) {
  if (!isSupabaseReady() || !id) return { error: 'Offline' };
  try {
    const { error } = await supabase.from('insumos').delete().eq('id', id);
    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

// ─── 3. PRECIFICAÇÃO E CANAIS ─────────────────────────────────────────────────

export async function fetchPrecificacaoCanais(unidadeId, fichaId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    let query = supabase
      .from('marmitaria_precificacao_canais')
      .select('*')
      .eq('unidade_id', unidadeId);

    if (fichaId) query = query.eq('ficha_id', fichaId);

    const { data, error } = await query;
    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarPrecificacaoCanal(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { error: 'Offline' };

  try {
    const { error } = await supabase
      .from('marmitaria_precificacao_canais')
      .upsert(
        {
          unidade_id: unidadeId,
          ficha_id: payload.ficha_id,
          canal: payload.canal,
          preco_venda: Number(payload.preco_venda) || 0,
          taxa_canal_pct: Number(payload.taxa_canal_pct) || 0,
          taxa_pagamento_pct: Number(payload.taxa_pagamento_pct) || 0,
          subsidio_entrega: Number(payload.subsidio_entrega) || 0,
          promocao_desconto: Number(payload.promocao_desconto) || 0,
          tributos_pct: Number(payload.tributos_pct) || 0,
          margem_meta_pct: Number(payload.margem_meta_pct) || 20,
          preco_sugerido: Number(payload.preco_sugerido) || 0,
          aprovado: payload.aprovado ?? true,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'unidade_id,ficha_id,canal' }
      );

    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

// ─── 4. SIMULAÇÕES DE VENDAS ──────────────────────────────────────────────────

export async function fetchSimulacoes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('marmitaria_simulacoes')
      .select('*')
      .eq('unidade_id', unidadeId)
      .order('criado_em', { ascending: false });

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarSimulacao(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const { data, error } = await supabase
      .from('marmitaria_simulacoes')
      .insert([
        {
          unidade_id: unidadeId,
          nome: payload.nome || 'Simulação de Vendas',
          descricao: payload.descricao || '',
          cenario_meta_diaria: Number(payload.cenario_meta_diaria) || 100,
          dias_operacao_mes: Number(payload.dias_operacao_mes) || 26,
          itens: payload.itens || [],
          resultado_consolidado: payload.resultado_consolidado || {},
        },
      ])
      .select()
      .single();

    return { data, error: error ? erroTexto(error) : null };
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

// ─── 5. PRODUÇÃO DE MARMITAS ──────────────────────────────────────────────────

export async function fetchProducaoLotes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('marmitaria_producao_lotes')
      .select(`
        *,
        fichas_tecnicas(id, nome_receita, categoria, tamanho_marmita, foto_url),
        colaboradores:responsavel_id(id, nome)
      `)
      .eq('unidade_id', unidadeId)
      .order('data_producao', { ascending: false });

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarProducaoLote(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    if (isNovo) {
      const codigo = payload.codigo || `LOTE-${Date.now().toString().slice(-6)}`;
      const { data, error } = await supabase
        .from('marmitaria_producao_lotes')
        .insert([
          {
            unidade_id: unidadeId,
            codigo,
            tipo_demanda: payload.tipo_demanda || 'antecipada',
            status: payload.status || 'planejado',
            ficha_id: payload.ficha_id,
            quantidade_planejada: Number(payload.quantidade_planejada) || 0,
            quantidade_produzida: Number(payload.quantidade_produzida) || 0,
            quantidade_perdas: Number(payload.quantidade_perdas) || 0,
            motivo_perda: payload.motivo_perda || null,
            rendimento_real_dados: payload.rendimento_real_dados || {},
            data_producao: payload.data_producao || new Date().toISOString().slice(0, 10),
            responsavel_id: payload.responsavel_id || null,
            custo_total: Number(payload.custo_total) || 0,
            baixou_ingredientes: payload.baixou_ingredientes || false,
            baixou_embalagens: payload.baixou_embalagens || false,
          },
        ])
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    } else {
      const { data, error } = await supabase
        .from('marmitaria_producao_lotes')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    }
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

// ─── 6. TRANSFERÊNCIAS DE ESTOQUE (COZINHA CENTRAL -> MARMITARIA) ─────────────

export async function fetchTransferenciasEstoque(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('marmitaria_transferencias')
      .select(`
        *,
        insumos(id, nome, unidade_medida),
        colaboradores:solicitado_por(id, nome)
      `)
      .eq('unidade_id', unidadeId)
      .order('data', { ascending: false });

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function registrarTransferenciaEstoque(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const { data, error } = await supabase
      .from('marmitaria_transferencias')
      .insert([
        {
          unidade_id: unidadeId,
          insumo_id: payload.insumo_id,
          quantidade: Number(payload.quantidade) || 0,
          unidade_medida: payload.unidade_medida || 'un',
          origem: payload.origem || 'cozinha_principal',
          destino: payload.destino || 'marmitaria',
          data: payload.data || new Date().toISOString().slice(0, 10),
          solicitado_por: payload.solicitado_por || null,
          status: 'concluido',
          observacao: payload.observacao || 'Transferência interna para a Marmitaria',
        },
      ])
      .select()
      .single();

    return { data, error: error ? erroTexto(error) : null };
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

// ─── 7. RH PRÓPRIO E ALOCAÇÃO DE EQUIPE ────────────────────────────────────────

export async function fetchRhAlocacoes(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('marmitaria_rh_alocacoes')
      .select(`
        *,
        colaboradores:colaborador_id(id, nome, cargo, turno, salario_base, remuneracao, ativo)
      `)
      .eq('unidade_id', unidadeId)
      .eq('ativo', true);

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarRhAlocacao(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { error: 'Offline' };

  try {
    const { error } = await supabase
      .from('marmitaria_rh_alocacoes')
      .upsert(
        {
          unidade_id: unidadeId,
          colaborador_id: payload.colaborador_id,
          tipo_alocacao: payload.tipo_alocacao || 'compartilhado',
          percentual_tempo: Number(payload.percentual_tempo) || 100,
          horas_por_semana: Number(payload.horas_por_semana) || 44,
          turno: payload.turno || 'Manhã',
          funcao_marmitaria: payload.funcao_marmitaria || 'Preparo e Montagem',
          ativo: payload.ativo ?? true,
        },
        { onConflict: 'unidade_id,colaborador_id' }
      );

    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

// ─── 8. CONFIGURAÇÕES DA MARMITARIA ───────────────────────────────────────────

export async function fetchConfiguracoesMarmitaria(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) {
    return {
      data: {
        taxa_ifood_padrao_pct: 15.0,
        taxa_cartao_padrao_pct: 2.5,
        impostos_padrao_pct: 6.0,
        margem_lucro_alvo_pct: 20.0,
        capacidade_diaria_marmitas: 150,
        horario_inicio: '09:00',
        horario_fim: '15:00',
        alocacao_custos_fixos_pct: 25.0,
        canais_ativos: ['ifood', 'whatsapp', 'balcao'],
      },
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('marmitaria_configuracoes')
      .select('*')
      .eq('unidade_id', unidadeId)
      .maybeSingle();

    if (error && !isTabelaAusente(error)) return { data: null, error: erroTexto(error) };

    const defaults = {
      taxa_ifood_padrao_pct: 15.0,
      taxa_cartao_padrao_pct: 2.5,
      impostos_padrao_pct: 6.0,
      margem_lucro_alvo_pct: 20.0,
      capacidade_diaria_marmitas: 150,
      horario_inicio: '09:00',
      horario_fim: '15:00',
      alocacao_custos_fixos_pct: 25.0,
      canais_ativos: ['ifood', 'whatsapp', 'balcao'],
    };

    return { data: data ? { ...defaults, ...data } : defaults, error: null };
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

export async function salvarConfiguracoesMarmitaria(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { error: 'Offline' };

  try {
    const { error } = await supabase
      .from('marmitaria_configuracoes')
      .upsert(
        {
          unidade_id: unidadeId,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'unidade_id' }
      );

    return { error: error ? erroTexto(error) : null };
  } catch (err) {
    return { error: erroTexto(err) };
  }
}

// ─── 9. PLANOS OPERACIONAIS 360º ──────────────────────────────────────────────

export async function fetchPlanosOperacionais(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('marmitaria_planos_operacionais')
      .select('*')
      .eq('unidade_id', unidadeId)
      .order('data_planejada', { ascending: false });

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarPlanoOperacional(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    if (isNovo) {
      const { data, error } = await supabase
        .from('marmitaria_planos_operacionais')
        .insert([
          {
            unidade_id: unidadeId,
            data_planejada: payload.data_planejada || new Date().toISOString().slice(0, 10),
            periodo_tipo: payload.periodo_tipo || 'amanha',
            meta_total_marmitas: Number(payload.meta_total_marmitas) || 100,
            faturamento_previsto: Number(payload.faturamento_previsto) || 0,
            cmv_previsto: Number(payload.cmv_previsto) || 0,
            margem_prevista: Number(payload.margem_prevista) || 0,
            pessoas_necessarias: Number(payload.pessoas_necessarias) || 2,
            status: payload.status || 'rascunho',
            dados_completos: payload.dados_completos || {},
          },
        ])
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    } else {
      const { data, error } = await supabase
        .from('marmitaria_planos_operacionais')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    }
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

// ─── 10. ASSINATURAS E RECORRÊNCIA ─────────────────────────────────────────────

export async function fetchAssinaturas(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('marmitaria_assinaturas')
      .select('*')
      .eq('unidade_id', unidadeId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarAssinatura(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    if (isNovo) {
      const { data, error } = await supabase
        .from('marmitaria_assinaturas')
        .insert([
          {
            unidade_id: unidadeId,
            cliente_nome: payload.cliente_nome,
            cliente_telefone: payload.cliente_telefone || null,
            plano_tipo: payload.plano_tipo || 'semanal',
            quantidade_marmitas_periodo: Number(payload.quantidade_marmitas_periodo) || 5,
            dias_entrega: payload.dias_entrega || ['seg', 'qua', 'sex'],
            valor_recorrente: Number(payload.valor_recorrente) || 120,
            forma_cobranca: payload.forma_cobranca || 'pix_semanal',
            status: payload.status || 'ativo',
            data_inicio: payload.data_inicio || new Date().toISOString().slice(0, 10),
            preferencias_cardapio: payload.preferencias_cardapio || '',
            endereco_entrega: payload.endereco_entrega || '',
          },
        ])
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    } else {
      const { data, error } = await supabase
        .from('marmitaria_assinaturas')
        .update(payload)
        .eq('id', payload.id)
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    }
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}

// ─── 11. GESTÃO DE QUALIDADE E ATENDIMENTO ─────────────────────────────────────

export async function fetchQualidadeOcorrencias(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from('marmitaria_qualidade_ocorrencias')
      .select(`
        *,
        fichas_tecnicas(id, nome_receita),
        colaboradores:responsavel_id(id, nome)
      `)
      .eq('unidade_id', unidadeId)
      .order('data', { ascending: false });

    if (error) {
      if (isTabelaAusente(error)) return { data: [], error: 'sem_tabela' };
      return { data: [], error: erroTexto(error) };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: [], error: erroTexto(err) };
  }
}

export async function salvarQualidadeOcorrencia(unidadeId, payload) {
  if (!isSupabaseReady() || !unidadeId) return { data: null, error: 'Offline' };

  try {
    const isNovo = !payload.id;
    if (isNovo) {
      const { data, error } = await supabase
        .from('marmitaria_qualidade_ocorrencias')
        .insert([
          {
            unidade_id: unidadeId,
            tipo: payload.tipo || 'erro_montagem',
            pedido_codigo: payload.pedido_codigo || null,
            produto_id: payload.produto_id || null,
            gravidade: payload.gravidade || 'baixa',
            nota_avaliacao: payload.nota_avaliacao ? Number(payload.nota_avaliacao) : null,
            custo_reembolso: Number(payload.custo_reembolso) || 0,
            descricao: payload.descricao || '',
            acao_corretiva: payload.acao_corretiva || '',
            responsavel_id: payload.responsavel_id || null,
            data: payload.data || new Date().toISOString().slice(0, 10),
          },
        ])
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    } else {
      const { data, error } = await supabase
        .from('marmitaria_qualidade_ocorrencias')
        .update(payload)
        .eq('id', payload.id)
        .select()
        .single();

      return { data, error: error ? erroTexto(error) : null };
    }
  } catch (err) {
    return { data: null, error: erroTexto(err) };
  }
}
