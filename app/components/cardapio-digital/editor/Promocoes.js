"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Search, Trash2 } from "lucide-react";
import { DIAS_SEMANA, LIMITES, TIPOS_PROMOCAO, errosDaPromocao, formatarPreco, gerarId, normalizarBusca, precoEfetivo, promocaoVigente, quandoVale, rotuloDaPromocao, normalizarPromocao } from "../../../lib/cardapio-digital.mjs";
import { Alternar, Aviso, Botao, Campo, Chip, Envio, Secao, inputCls } from "./ui";

function EscolherPratos({ produtos, ids, onChange }) {
  const [busca, setBusca] = useState("");
  const b = normalizarBusca(busca);
  const marcados = new Set(ids);
  const lista = produtos.filter((p) => !b || normalizarBusca(p.nome).includes(b));
  return (
    <div>
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input className={`${inputCls} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato para a promoção" aria-label="Buscar prato para a promoção" />
      </label>
      <p className="mt-1 text-xs text-hf-muted">{ids.length} {ids.length === 1 ? "prato escolhido" : "pratos escolhidos"}{ids.length ? " · " : ""}
        {ids.length ? <button type="button" className="font-semibold text-hf-accent" onClick={() => onChange([])}>limpar</button> : null}</p>
      <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-hf-border">
        {lista.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 text-sm hover:bg-hf-elevated/60">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={marcados.has(p.id)}
                onChange={() => onChange(marcados.has(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id])} />
              <span className="min-w-0 flex-1 truncate">{p.nome}</span>
              <span className="tabular-nums text-hf-muted">{formatarPreco(p.preco_venda)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Promocoes({ config, mudar, unidadeId, produtos }) {
  const [aberta, setAberta] = useState(null);
  const lista = config.promocoes;
  const setLista = (fn) => mudar((c) => ({ ...c, promocoes: fn(c.promocoes) }));
  const editar = (id, campos) => setLista((l) => l.map((p) => (p.id === id ? { ...p, ...campos } : p)));
  const agora = new Date();
  const opcoes = produtos.map((p) => ({ id: String(p.id), nome: p.ficha?.nome_comercial || p.nome_produto, preco_venda: p.preco_venda })).filter((p) => p.preco_venda > 0);

  const nova = () => {
    const id = gerarId("promo", lista.map((p) => p.id));
    setLista((l) => [...l, { id, titulo: "Nova promoção", texto: "", imagem_url: "", produto_ids: [], tipo: "desconto", preco_promocional: null, desconto_pct: 10, dias_semana: [], hora_inicio: "", hora_fim: "", data_inicio: "", data_fim: "", ativa: true }]);
    setAberta(id);
  };

  return (
    <div className="space-y-4">
      <Secao titulo="Promoções" subtitulo="Desconto ou preço especial com dia e horário (happy hour, almoço executivo). O preço da promoção é cobrado de verdade no pedido, só enquanto ela vale."
        direita={lista.length < LIMITES.promocoes ? <Botao onClick={nova}><Plus size={16} /> Nova promoção</Botao> : null}>
        {!lista.length ? <Aviso>Nenhuma promoção ainda. “Só um aviso” serve para música ao vivo, feriado, novidade — sem mudar preço.</Aviso> : null}
        <ul className="space-y-2">
          {lista.map((p) => {
            const erros = errosDaPromocao(p);
            const n = normalizarPromocao(p);
            const vale = !erros.length && promocaoVigente(p, agora);
            const situacao = !p.ativa ? "Desligada" : erros.length ? "Incompleta" : vale ? "Valendo agora" : "Fora do dia ou horário";
            const exemplo = opcoes.find((o) => n.produto_ids.includes(o.id));
            const efeito = exemplo && n.tipo !== "aviso" ? precoEfetivo({ id: exemplo.id, preco_venda: exemplo.preco_venda }, [{ ...n, ativa: true }]) : null;
            return (
              <li key={p.id} className="rounded-xl border border-hf-border">
                <button type="button" onClick={() => setAberta(aberta === p.id ? null : p.id)} aria-expanded={aberta === p.id}
                  className="flex min-h-[56px] w-full items-center gap-3 p-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-hf-text">{p.titulo || "Sem nome"} {rotuloDaPromocao(p) ? <span className="font-semibold text-hf-accent">· {rotuloDaPromocao(p)}</span> : null}</span>
                    <span className="block truncate text-xs text-hf-muted">{quandoVale(p) || "Todos os dias, o dia todo"}</span>
                  </span>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${vale ? "bg-hf-accent/10 text-hf-accent" : erros.length && p.ativa ? "bg-hf-warning/10 text-hf-warning" : "bg-hf-elevated text-hf-text-2"}`}>{situacao}</span>
                  {aberta === p.id ? <ChevronUp size={18} className="text-hf-muted" /> : <ChevronDown size={18} className="text-hf-muted" />}
                </button>
                {aberta === p.id ? (
                  <div className="grid gap-3 border-t border-hf-border p-3 sm:grid-cols-2">
                    {erros.length ? <Aviso tipo="alerta" className="sm:col-span-2">{erros.join(" ")}</Aviso> : null}
                    <Campo rotulo="Nome"><input className={inputCls} value={p.titulo} maxLength={60} onChange={(e) => editar(p.id, { titulo: e.target.value })} /></Campo>
                    <Campo rotulo="Tipo">
                      <select className={inputCls} value={p.tipo} onChange={(e) => editar(p.id, { tipo: e.target.value })}>
                        {TIPOS_PROMOCAO.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
                      </select>
                    </Campo>
                    {p.tipo === "desconto" ? (
                      <Campo rotulo="Desconto (%)" dica="De 1% a 90%.">
                        <input className={`${inputCls} tabular-nums`} inputMode="numeric" value={p.desconto_pct ?? ""} onChange={(e) => editar(p.id, { desconto_pct: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                      </Campo>
                    ) : null}
                    {p.tipo === "preco" ? (
                      <Campo rotulo="Preço especial (R$)" dica="Só vale se for menor que o preço normal de cada prato.">
                        <input className={`${inputCls} tabular-nums`} inputMode="decimal" placeholder="0,00"
                          value={p.preco_promocional == null ? "" : typeof p.preco_promocional === "number" ? String(p.preco_promocional).replace(".", ",") : p.preco_promocional}
                          onChange={(e) => editar(p.id, { preco_promocional: e.target.value.replace(/[^0-9,]/g, "").slice(0, 9) || null })} />
                      </Campo>
                    ) : null}
                    <Campo rotulo="Frase (opcional)" className="sm:col-span-2"><input className={inputCls} value={p.texto} maxLength={160} onChange={(e) => editar(p.id, { texto: e.target.value })} placeholder="Ex.: Drinks com 20% off no fim de tarde" /></Campo>
                    <div className="sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-hf-text-2">Dias (nenhum marcado = todos)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                          const ativo = (p.dias_semana || []).includes(d);
                          return <Chip key={d} ativo={ativo} onClick={() => editar(p.id, { dias_semana: ativo ? p.dias_semana.filter((x) => x !== d) : [...(p.dias_semana || []), d] })}>{DIAS_SEMANA[d]}</Chip>;
                        })}
                      </div>
                    </div>
                    <Campo rotulo="Começa às (opcional)"><input type="time" className={inputCls} value={p.hora_inicio} onChange={(e) => editar(p.id, { hora_inicio: e.target.value })} /></Campo>
                    <Campo rotulo="Termina às (opcional)" dica="Pode passar da meia-noite (22:00 às 02:00)."><input type="time" className={inputCls} value={p.hora_fim} onChange={(e) => editar(p.id, { hora_fim: e.target.value })} /></Campo>
                    <Campo rotulo="A partir do dia (opcional)"><input type="date" className={inputCls} value={p.data_inicio} onChange={(e) => editar(p.id, { data_inicio: e.target.value })} /></Campo>
                    <Campo rotulo="Até o dia (opcional)"><input type="date" className={inputCls} value={p.data_fim} onChange={(e) => editar(p.id, { data_fim: e.target.value })} /></Campo>
                    {p.tipo !== "aviso" ? (
                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-hf-text-2">Pratos da promoção</span>
                        <EscolherPratos produtos={opcoes} ids={p.produto_ids || []} onChange={(ids) => editar(p.id, { produto_ids: ids })} />
                        {efeito?.promocao_id ? <p className="mt-2 text-xs text-hf-text-2">Exemplo: {exemplo.nome} sai de {formatarPreco(efeito.preco_original)} por <strong>{formatarPreco(efeito.preco)}</strong>.</p> : null}
                        {exemplo && efeito && !efeito.promocao_id ? <p className="mt-2 text-xs font-semibold text-hf-warning">Com esse valor o preço não baixa — a promoção não muda nada.</p> : null}
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <Envio rotulo="Imagem (opcional)" url={p.imagem_url} unidadeId={unidadeId} pasta="promocoes" compacto onEnviado={(url) => editar(p.id, { imagem_url: url })} onRemover={() => editar(p.id, { imagem_url: "" })} />
                    </div>
                    <Alternar ativo={p.ativa !== false} onChange={(v) => editar(p.id, { ativa: v })} rotulo="Ligada" dica="Desligada, fica guardada mas não aparece nem muda preço." />
                    <Botao variante="perigo" onClick={() => setLista((l) => l.filter((x) => x.id !== p.id))}><Trash2 size={16} /> Apagar a promoção</Botao>
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
