"use client";

// Combos do cardápio (pedido do dono, 27/10/2026: "combos, promoções e
// descontos, como nas plataformas"). Pratos juntos por um preço só; o preço
// do combo é cobrado no pedido pelo servidor e cada prato vai para a
// cozinha/bar. Regras em cardapio-digital.mjs (normalizarCombo, errosDoCombo).

import { useState } from "react";
import { ChevronDown, ChevronUp, Minus, Plus, Search, Trash2 } from "lucide-react";
import { DIAS_SEMANA, LIMITES, errosDoCombo, formatarPreco, gerarId, normalizarBusca, normalizarCombo, promocaoVigente, quandoVale } from "../../../lib/cardapio-digital.mjs";
import { Alternar, Aviso, Botao, Campo, Chip, Envio, Secao, inputCls } from "./ui";

function ItensDoCombo({ produtos, itens, onChange }) {
  const [busca, setBusca] = useState("");
  const b = normalizarBusca(busca);
  const qtd = new Map(itens.map((i) => [i.produto_id, i.quantidade]));
  const lista = produtos.filter((p) => !b || normalizarBusca(p.nome).includes(b)).slice(0, 60);
  const definir = (id, q) => {
    const resto = itens.filter((i) => i.produto_id !== id);
    onChange(q > 0 ? [...resto, { produto_id: id, quantidade: q }] : resto);
  };
  return (
    <div>
      {itens.length ? (
        <ul className="mb-2 space-y-1">
          {itens.map((i) => {
            const p = produtos.find((x) => x.id === i.produto_id);
            return (
              <li key={i.produto_id} className="flex items-center gap-2 rounded-xl bg-hf-accent/5 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold text-hf-text">{p?.nome || "Prato fora do cardápio"}</span>
                <span className="tabular-nums text-xs text-hf-muted">{p ? formatarPreco(p.preco_venda) : ""}</span>
                <button type="button" onClick={() => definir(i.produto_id, i.quantidade - 1)} aria-label={`Menos ${p?.nome || ""}`} className="grid h-8 w-8 place-items-center rounded-lg border border-hf-border bg-hf-surface"><Minus size={14} /></button>
                <span className="w-5 text-center font-black tabular-nums">{i.quantidade}</span>
                <button type="button" onClick={() => definir(i.produto_id, Math.min(10, i.quantidade + 1))} aria-label={`Mais ${p?.nome || ""}`} className="grid h-8 w-8 place-items-center rounded-lg border border-hf-border bg-hf-surface"><Plus size={14} /></button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input className={`${inputCls} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato ou drink para o combo" aria-label="Buscar prato para o combo" />
      </label>
      <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-hf-border">
        {lista.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => definir(p.id, (qtd.get(p.id) || 0) + 1)} disabled={!qtd.has(p.id) && itens.length >= LIMITES.itensPorCombo}
              className="flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-sm hover:bg-hf-elevated/60 disabled:opacity-40">
              <Plus size={16} className="text-hf-accent" />
              <span className="min-w-0 flex-1 truncate">{p.nome}</span>
              <span className="tabular-nums text-hf-muted">{formatarPreco(p.preco_venda)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Combos({ config, mudar, unidadeId, produtos }) {
  const [aberto, setAberto] = useState(null);
  const lista = config.combos || [];
  const setLista = (fn) => mudar((c) => ({ ...c, combos: fn(c.combos || []) }));
  const editar = (id, campos) => setLista((l) => l.map((x) => (x.id === id ? { ...x, ...campos } : x)));
  const opcoes = produtos.map((p) => ({ id: String(p.id), nome: p.ficha?.nome_comercial || p.nome_produto, preco_venda: Number(p.preco_venda) || 0 })).filter((p) => p.preco_venda > 0);
  const porId = new Map(opcoes.map((p) => [p.id, p]));
  const agora = new Date();

  const novo = () => {
    const id = gerarId("c", lista.map((x) => x.id));
    setLista((l) => [...l, { id, nome: "Novo combo", descricao: "", imagem_url: "", itens: [], preco: null, dias_semana: [], hora_inicio: "", hora_fim: "", data_inicio: "", data_fim: "", ativa: true }]);
    setAberto(id);
  };

  return (
    <div className="space-y-4">
      <Secao titulo="Combos" subtitulo="Pratos e drinks juntos por um preço só (ex.: prato + bebida + sobremesa). Aparecem no topo do cardápio, com o preço de/por. No pedido, o preço do combo é cobrado e cada item vai para a cozinha ou o bar."
        direita={lista.length < LIMITES.combos ? <Botao onClick={novo}><Plus size={16} /> Novo combo</Botao> : null}>
        {!lista.length ? <Aviso>Nenhum combo ainda. Combo só aparece quando todos os itens dele estão no cardápio.</Aviso> : null}
        <ul className="space-y-2">
          {lista.map((c) => {
            const erros = errosDoCombo(c);
            const n = normalizarCombo(c);
            const separado = n.itens.reduce((t, i) => t + (porId.get(i.produto_id)?.preco_venda || 0) * i.quantidade, 0);
            const economia = n.preco ? separado - n.preco : 0;
            const fora = n.itens.filter((i) => !porId.has(i.produto_id)).length;
            const vale = !erros.length && !fora && promocaoVigente({ ...n, titulo: n.nome }, agora);
            const situacao = c.ativa === false ? "Desligado" : erros.length ? "Incompleto" : fora ? "Item fora do cardápio" : vale ? "No cardápio agora" : "Fora do dia ou horário";
            return (
              <li key={c.id} className="rounded-xl border border-hf-border">
                <button type="button" onClick={() => setAberto(aberto === c.id ? null : c.id)} aria-expanded={aberto === c.id}
                  className="flex min-h-[56px] w-full items-center gap-3 p-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-hf-text">{c.nome || "Sem nome"}{n.preco ? <span className="font-semibold text-hf-accent"> · {formatarPreco(n.preco)}</span> : null}</span>
                    <span className="block truncate text-xs text-hf-muted">{n.itens.map((i) => `${i.quantidade}× ${porId.get(i.produto_id)?.nome || "?"}`).join(" + ") || "Escolha os itens"}</span>
                  </span>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${vale ? "bg-hf-accent/10 text-hf-accent" : (erros.length || fora) && c.ativa !== false ? "bg-hf-warning/10 text-hf-warning" : "bg-hf-elevated text-hf-text-2"}`}>{situacao}</span>
                  {aberto === c.id ? <ChevronUp size={18} className="text-hf-muted" /> : <ChevronDown size={18} className="text-hf-muted" />}
                </button>
                {aberto === c.id ? (
                  <div className="grid gap-3 border-t border-hf-border p-3 sm:grid-cols-2">
                    {erros.length ? <Aviso tipo="alerta" className="sm:col-span-2">{erros.join(" ")}</Aviso> : null}
                    <Campo rotulo="Nome do combo"><input className={inputCls} value={c.nome} maxLength={60} onChange={(e) => editar(c.id, { nome: e.target.value })} /></Campo>
                    <Campo rotulo="Preço do combo (R$)" dica={separado > 0 ? `Separados: ${formatarPreco(separado)}${economia > 0 ? ` · o cliente economiza ${formatarPreco(economia)}` : ""}` : "Escolha os itens para ver a soma separada."}>
                      <input className={`${inputCls} tabular-nums`} inputMode="decimal" placeholder="0,00"
                        value={c.preco == null ? "" : typeof c.preco === "number" ? String(c.preco).replace(".", ",") : c.preco}
                        onChange={(e) => editar(c.id, { preco: e.target.value.replace(/[^0-9,]/g, "").slice(0, 9) || null })} />
                    </Campo>
                    {n.preco && separado > 0 && economia < 0 ? <Aviso tipo="alerta" className="sm:col-span-2">O combo está mais caro que os itens separados ({formatarPreco(separado)}).</Aviso> : null}
                    <Campo rotulo="Descrição (opcional)" className="sm:col-span-2" dica="Sem descrição, o cardápio mostra o que vem no combo.">
                      <input className={inputCls} value={c.descricao} maxLength={200} onChange={(e) => editar(c.id, { descricao: e.target.value })} placeholder="Ex.: Almoço completo com bebida e sobremesa" />
                    </Campo>
                    <div className="sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-hf-text-2">O que vem no combo</span>
                      <ItensDoCombo produtos={opcoes} itens={n.itens} onChange={(itens) => editar(c.id, { itens })} />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-hf-text-2">Dias (nenhum marcado = todos)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                          const ativo = (c.dias_semana || []).includes(d);
                          return <Chip key={d} ativo={ativo} onClick={() => editar(c.id, { dias_semana: ativo ? c.dias_semana.filter((x) => x !== d) : [...(c.dias_semana || []), d] })}>{DIAS_SEMANA[d]}</Chip>;
                        })}
                      </div>
                      <p className="mt-1 text-xs text-hf-muted">{quandoVale(n) || "Todos os dias, o dia todo"}</p>
                    </div>
                    <Campo rotulo="Começa às (opcional)"><input type="time" className={inputCls} value={c.hora_inicio} onChange={(e) => editar(c.id, { hora_inicio: e.target.value })} /></Campo>
                    <Campo rotulo="Termina às (opcional)"><input type="time" className={inputCls} value={c.hora_fim} onChange={(e) => editar(c.id, { hora_fim: e.target.value })} /></Campo>
                    <div className="sm:col-span-2">
                      <Envio rotulo="Foto do combo (opcional)" url={c.imagem_url} unidadeId={unidadeId} pasta="combos" compacto onEnviado={(url) => editar(c.id, { imagem_url: url })} onRemover={() => editar(c.id, { imagem_url: "" })} />
                    </div>
                    <Alternar ativo={c.ativa !== false} onChange={(v) => editar(c.id, { ativa: v })} rotulo="Ligado" dica="Desligado, fica guardado mas não aparece." />
                    <Botao variante="perigo" onClick={() => setLista((l) => l.filter((x) => x.id !== c.id))}><Trash2 size={16} /> Apagar o combo</Botao>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Secao>
    </div>
  );
}
