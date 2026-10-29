"use client";

import { useMemo, useState } from "react";
import { CANAIS_CARDAPIO, errosDaPromocao, formatarPreco, normalizarBusca } from "../../../lib/cardapio-digital.mjs";
import { contaDaPromocao, REGRAS_LEVE, TIPOS_PAINEL } from "../../../lib/cardapio-promocoes-painel.mjs";
import { PalavraDesconto } from "../ui";
import MenuPainel from "./MenuPainel";
import s from "./painel.module.css";

// Painel → Promoções e descontos (protótipo PainelPromocoes, 9K.2): a lista
// com status e lucro de cada promoção, e o formulário com a "Conta da
// promoção" (custo da ficha técnica) e "Como o cliente vê". Só desenha;
// quem lê e grava é a página.

const DIAS_TELA = [[1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"], [0, "Dom"]];
const TOM_VEREDITO = { ok: "", baixa: s.promoVereditoBaixa, prejuizo: s.promoVereditoRuim, sem_custo: s.promoVereditoNeutro, vazio: s.promoVereditoNeutro };
const TOM_LUCRO = { ok: "", baixa: s.promoLucroBaixo, prejuizo: s.promoLucroRuim };

export default function PainelPromocoes({
  nomeLoja = "", lista = [], resumo = [], form, setForm, editando = null, produtos = [], categorias = [], custos = {},
  metaPct = 0, taxaEntrega = 0, pctCadastro = 0, fotoDe = () => "", salvando = false, erro = "", aviso = "",
  onNova, onEditar, onAtivar, onSalvar, onExcluir, linkCombos = "#", itensMenu,
}) {
  const [buscando, setBuscando] = useState(false);
  const [termo, setTermo] = useState("");
  const muda = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const escolhidos = (form.produto_ids || []).map((id) => porId.get(id)).filter(Boolean);
  const primeiro = escolhidos[0];
  const conta = form.tipo === "combo" ? null : contaDaPromocao(form, {
    produto: primeiro ? { id: primeiro.id, nome: primeiro.nome, preco: primeiro.preco } : null,
    custo: primeiro ? custos[primeiro.id] : null, metaPct, taxaEntrega,
  });
  const erros = form.tipo === "combo" ? [] : errosDaPromocao(form);
  const canais = form.canais?.length ? form.canais : CANAIS_CARDAPIO.map((c) => c.id);
  const dias = form.dias_semana?.length ? form.dias_semana : DIAS_TELA.map(([d]) => d);

  const achados = useMemo(() => {
    const t = normalizarBusca(termo);
    const ja = new Set(form.produto_ids || []);
    const cats = categorias.filter((c) => c.qtd && (!t || normalizarBusca(c.nome).includes(t)));
    const prods = produtos.filter((p) => !ja.has(p.id) && (!t || p.busca?.includes(t) || normalizarBusca(p.nome).includes(t))).slice(0, 30);
    return { cats, prods };
  }, [termo, categorias, produtos, form.produto_ids]);
  const adicionar = (ids) => muda("produto_ids", [...new Set([...(form.produto_ids || []), ...ids])]);
  const alternar = (lista, v, todos) => {
    const atual = new Set(lista);
    if (atual.has(v)) atual.delete(v); else atual.add(v);
    const novo = todos.filter((x) => atual.has(x));
    return novo.length === todos.length ? [] : novo;
  };

  return (
    <div className={s.raiz}>
      <MenuPainel atual="promocoes" nomeLoja={nomeLoja} itens={itensMenu} />
      <main className={s.conteudo}>
        <div className={s.topo}>
          <h1 className={s.titulo}>Promoções e descontos</h1>
          <button type="button" className={s.acaoPrincipal} onClick={onNova}>+ Nova promoção</button>
        </div>
        {erro ? <div role="alert" className={s.erro}>{erro}</div> : null}
        {aviso ? <div className={s.aviso}>{aviso}</div> : null}

        <div className={s.promoColunas}>
          <section aria-label="Promoções" className={s.promoLista}>
            <div className={s.promoResumo}>
              {resumo.map((r) => (
                <div key={r.rotulo} className={s.promoNumero}>
                  <span className={s.promoNumeroRotulo}>{r.rotulo}</span>
                  <span className={`${s.promoNumeroValor} ${r.tom === "ok" ? s.promoNumeroOk : r.tom === "alerta" ? s.promoNumeroAlerta : ""}`}>{r.valor}</span>
                  <span className={s.promoNumeroSub}>{r.sub}</span>
                </div>
              ))}
            </div>
            <span className={s.promoNota}>Lucro pela ficha técnica de hoje · vendas por promoção começam a contar nos pedidos novos</span>
            {!lista.length ? <div className={s.promoVazio}>Nenhuma promoção ainda. Crie a primeira no formulário ao lado.</div> : null}
            {lista.map((p) => (
              <article key={p.id} className={`${s.promoCard} ${p.noAr ? s.promoCardNoAr : ""} ${editando === p.id ? s.promoCardEditando : ""}`}>
                <div aria-hidden="true" className={`${s.promoSelo} ${!p.ativa ? s.promoSeloPausada : p.tipoId === "leve_mais" ? s.promoSeloLeve : p.tipoId === "desconto" ? s.promoSeloPrincipal : ""}`}>{p.selo}</div>
                <div className={s.promoTextos}>
                  <div className={s.promoLinhaNome}>
                    <span className={s.promoNome}>{p.nome}</span>
                    <span className={s.promoTipo}>{p.tipo}</span>
                  </div>
                  <span className={s.promoRegra}>{p.regra}</span>
                  <span className={s.promoQuando}>{p.quando} · {p.canais}</span>
                  {p.ganha || p.lucro ? (
                    <span className={s.promoEtiquetas}>
                      {p.ganha ? <span className={s.promoGanha}>Cliente ganha {p.ganha}</span> : null}
                      {p.lucro ? <span className={`${s.promoLucro} ${TOM_LUCRO[p.nivel] || ""}`}>Lucro {p.lucro}</span> : null}
                      {p.nivel === "sem_custo" ? <span className={s.promoGanha}>Sem custo na ficha</span> : null}
                    </span>
                  ) : null}
                </div>
                <label className={`${s.promoStatus} ${p.ativa ? s.promoStatusAtiva : ""}`}>
                  <input type="checkbox" checked={p.ativa} disabled={salvando} onChange={(e) => onAtivar?.(p.id, e.target.checked)} aria-label={`Ativa: ${p.nome}`} />
                  {p.status}
                </label>
                <button type="button" className={s.promoEditar} onClick={() => onEditar?.(p.id)}>Editar</button>
              </article>
            ))}
          </section>

          <aside aria-labelledby="t-form" className={s.promoForm}>
            <h2 id="t-form" className={s.promoFormTitulo}>{editando ? "Editar promoção" : "Nova promoção"}</h2>
            <fieldset className={s.promoGrupo}>
              <legend className={s.promoRotulo}>Tipo</legend>
              <div className={s.promoTipos}>
                {TIPOS_PAINEL.map((t) => (
                  <label key={t.id} className={`${s.promoTipoOpcao} ${form.tipo === t.id ? s.promoTipoSel : ""}`}>
                    <input type="radio" name="tipo-promo" checked={form.tipo === t.id} onChange={() => muda("tipo", t.id)} />{t.nome}
                  </label>
                ))}
              </div>
            </fieldset>

            {form.tipo === "combo" ? (
              <div className={s.aviso}>
                Combos (vários pratos por um preço) têm o editor próprio, com a soma dos pratos e o preço do combo.{" "}
                <a href={linkCombos}>Abrir os combos</a>
              </div>
            ) : (
              <>
                <label className={s.promoCampo}>Nome que o cliente vê
                  <input className={s.promoEntrada} value={form.titulo} maxLength={60} onChange={(e) => muda("titulo", e.target.value)} placeholder="Ex.: Happy hour · chope em dobro" />
                </label>

                {form.tipo !== "frete_gratis" ? (
                  <div className={s.promoGrupo}>
                    <span className={s.promoRotulo}>Aplica em</span>
                    <div className={s.promoChips}>
                      {escolhidos.map((p) => (
                        <button key={p.id} type="button" className={s.promoChip} aria-label={`Tirar ${p.nome}`}
                          onClick={() => muda("produto_ids", form.produto_ids.filter((x) => x !== p.id))}>{p.nome} ×</button>
                      ))}
                      <button type="button" className={s.promoAdicionar} aria-expanded={buscando} onClick={() => setBuscando((b) => !b)}>+ produto ou categoria</button>
                    </div>
                    {buscando ? (
                      <div className={s.promoBusca}>
                        <input className={s.promoEntrada} type="search" autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar prato ou categoria" aria-label="Buscar prato ou categoria" />
                        {achados.cats.map((c) => (
                          <button key={`c-${c.id}`} type="button" className={`${s.promoBuscaItem} ${s.promoBuscaCategoria}`}
                            onClick={() => adicionar(produtos.filter((p) => p.categoria_id === c.id).map((p) => p.id))}>
                            <span>Categoria: {c.nome}</span><span>{c.qtd} pratos</span>
                          </button>
                        ))}
                        {achados.prods.map((p) => (
                          <button key={p.id} type="button" className={s.promoBuscaItem} onClick={() => adicionar([p.id])}>
                            <span>{p.nome}</span><span>{formatarPreco(p.preco)}</span>
                          </button>
                        ))}
                        {!achados.cats.length && !achados.prods.length ? <span className={s.promoNota}>Nada encontrado.</span> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className={s.promoGrupo}>
                  <span className={s.promoRotulo}>Regra</span>
                  {form.tipo === "leve_mais" ? (
                    <div className={s.promoRegras}>
                      {REGRAS_LEVE.map(([pague, leve]) => {
                        const on = Number(form.pague) === pague && Number(form.leve) === leve;
                        return (
                          <button key={`${pague}-${leve}`} type="button" aria-pressed={on} className={`${s.promoRegraBotao} ${on ? s.promoRegraSel : ""}`}
                            onClick={() => setForm((f) => ({ ...f, pague, leve }))}>Pegue {pague}, leve {leve}</button>
                        );
                      })}
                    </div>
                  ) : form.tipo === "desconto" ? (
                    <label className={s.promoHorario}>
                      <input className={`${s.promoEntrada} ${s.promoEntradaCurta}`} inputMode="numeric" value={form.desconto_pct ?? ""} onChange={(e) => muda("desconto_pct", e.target.value.replace(/\D/g, ""))} aria-label="Desconto em %" />
                      % de <PalavraDesconto espacoAntes={false} /> no preço
                    </label>
                  ) : form.tipo === "desconto_valor" ? (
                    <label className={s.promoHorario}>
                      R$ <input className={`${s.promoEntrada} ${s.promoEntradaCurta}`} inputMode="decimal" value={form.desconto_valor ?? ""} onChange={(e) => muda("desconto_valor", e.target.value)} aria-label="Desconto em reais" /> a menos em cada prato
                    </label>
                  ) : form.tipo === "preco" ? (
                    <label className={s.promoHorario}>
                      Por R$ <input className={`${s.promoEntrada} ${s.promoEntradaCurta}`} inputMode="decimal" value={form.preco_promocional ?? ""} onChange={(e) => muda("preco_promocional", e.target.value)} aria-label="Preço especial" />
                    </label>
                  ) : form.tipo === "frete_gratis" ? (
                    <label className={s.promoHorario}>
                      Pedidos acima de R$ <input className={`${s.promoEntrada} ${s.promoEntradaCurta}`} inputMode="decimal" value={form.frete_minimo ?? ""} onChange={(e) => muda("frete_minimo", e.target.value)} aria-label="Valor mínimo para o frete grátis" placeholder="0,00" />
                    </label>
                  ) : null}
                </div>

                {conta ? (
                  <section aria-label="Conta da promoção" className={s.promoConta}>
                    <div className={s.promoContaTopo}>
                      <span>Conta da promoção{primeiro && escolhidos.length > 1 ? ` · ${primeiro.nome}` : ""}</span>
                      <span className={s.promoContaFonte}>Custo vem da ficha técnica</span>
                    </div>
                    {conta.linhas.length ? (
                      <div className={s.promoContaLinhas}>
                        {conta.linhas.map((l) => (
                          <div key={l.rotulo} className={`${s.promoContaLinha} ${l.tom === "ganho" ? s.promoContaGanho : l.tom === "custo" ? s.promoContaCusto : l.tom === "total" ? s.promoContaTotal : ""}`}>
                            <span>{l.rotulo}</span><span className={s.promoContaValor}>{l.valor}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className={`${s.promoVeredito} ${TOM_VEREDITO[conta.veredito.nivel] || ""}`} role="status">
                      <span aria-hidden="true" className={s.promoVereditoIcone}>{conta.veredito.nivel === "ok" ? "✓" : "!"}</span>
                      <span className={s.promoVereditoTextos}>
                        <span className={s.promoVereditoTitulo}>{conta.veredito.titulo}</span>
                        <span className={s.promoVereditoTexto}>{conta.veredito.texto}</span>
                      </span>
                    </div>
                  </section>
                ) : null}

                {conta?.cliente ? (
                  <div className={s.promoGrupo}>
                    <span className={s.promoRotulo}>Como o cliente vê</span>
                    <div className={s.promoCliente}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {fotoDe(primeiro?.id) ? <img className={s.promoClienteFoto} src={fotoDe(primeiro.id)} alt="" /> : <span className={s.promoClienteFoto} aria-hidden="true" />}
                      <span className={s.promoClienteTextos}>
                        <span className={s.promoClienteEtiqueta}>{conta.cliente.etiqueta}</span>
                        <span className={s.promoClienteTitulo}>{conta.cliente.titulo}</span>
                        <span className={s.promoClientePreco}>
                          {conta.cliente.de > conta.cliente.por ? <><span className={s.promoRiscado}>{formatarPreco(conta.cliente.de)}</span> </> : null}
                          <strong>{formatarPreco(conta.cliente.por)}</strong>
                        </span>
                      </span>
                      {conta.cliente.ganha > 0 ? <span className={s.promoClienteGanha}>Você ganha<br />{formatarPreco(conta.cliente.ganha)}</span> : null}
                    </div>
                  </div>
                ) : null}

                <div className={s.promoGrupo}>
                  <span className={s.promoRotulo}>Quando</span>
                  <div className={s.dias}>
                    {DIAS_TELA.map(([d, nome]) => {
                      const on = dias.includes(d);
                      return (
                        <button key={d} type="button" aria-pressed={on} className={`${s.dia} ${on ? s.diaSel : ""}`}
                          onClick={() => muda("dias_semana", alternar(dias, d, DIAS_TELA.map(([x]) => x)))}>{nome}</button>
                      );
                    })}
                  </div>
                  <div className={s.promoHorario}>
                    <input type="time" className={`${s.promoEntrada} ${s.promoHora}`} value={form.hora_inicio || ""} onChange={(e) => muda("hora_inicio", e.target.value)} aria-label="Início" />
                    até
                    <input type="time" className={`${s.promoEntrada} ${s.promoHora}`} value={form.hora_fim || ""} onChange={(e) => muda("hora_fim", e.target.value)} aria-label="Fim" />
                    <span className={s.promoNota}>vazio = o dia todo</span>
                  </div>
                </div>

                <div className={s.promoGrupo}>
                  <span className={s.promoRotulo}>Canais</span>
                  <div className={s.promoCanais}>
                    {CANAIS_CARDAPIO.map((c) => (
                      <label key={c.id} className={s.promoMarcar}>
                        <input type="checkbox" checked={canais.includes(c.id)}
                          onChange={() => muda("canais", alternar(canais, c.id, CANAIS_CARDAPIO.map((x) => x.id)))} />{c.rotulo}
                      </label>
                    ))}
                  </div>
                </div>
                <label className={s.promoMarcar}>
                  <input type="checkbox" checked={form.mostrar_agora !== false} onChange={(e) => muda("mostrar_agora", e.target.checked)} />
                  Mostrar em &quot;Agora na casa&quot; no tablet e no delivery
                </label>
                <label className={s.promoMarcar}>
                  <input type="checkbox" checked={!!form.acumula_cadastro} onChange={(e) => muda("acumula_cadastro", e.target.checked)} />
                  <span>Acumula com {pctCadastro ? `os ${pctCadastro}% de` : "o"} <PalavraDesconto espacoAntes={false} /> do cadastro</span>
                </label>

                {erros.length ? <ul className={s.promoErros}>{erros.map((e) => <li key={e}>{e}</li>)}</ul> : null}
                <div className={s.promoLinhaBotoes}>
                  <button type="button" className={s.promoSalvar} disabled={salvando || erros.length > 0} onClick={onSalvar}>{salvando ? "Salvando…" : "Salvar promoção"}</button>
                  {editando ? <button type="button" className={s.promoExcluir} disabled={salvando} onClick={onExcluir}>Excluir</button> : null}
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
