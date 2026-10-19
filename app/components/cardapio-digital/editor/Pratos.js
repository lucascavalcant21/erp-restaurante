"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Search, Star } from "lucide-react";
import { SELOS, categoriaDoProduto, centavos, formatarPreco, normalizarBusca } from "../../../lib/cardapio-digital.mjs";
import { Alternar, Aviso, Botao, Campo, Chip, Envio, Secao, inputCls } from "./ui";

const fichaAtiva = (f) => !f || (f.ativo !== false && (!f.status || ["ativa", "ativo"].includes(String(f.status).toLowerCase())));

export default function Pratos({ config, mudar, unidadeId, juntos, categorias, pendentes, setPendentes, fichasSemProduto, onCriarProduto }) {
  const [busca, setBusca] = useState("");
  const [secao, setSecao] = useState("");
  const [aberto, setAberto] = useState(null);
  const [marcados, setMarcados] = useState([]);
  const [destino, setDestino] = useState("");
  const [precos, setPrecos] = useState({});
  const [criando, setCriando] = useState("");
  const [erroCriar, setErroCriar] = useState({});

  const item = (id) => config.itens[id] || {};
  const setItem = (id, campos) => mudar((c) => {
    const atual = { ...(c.itens[id] || {}), ...campos };
    for (const k of Object.keys(atual)) if (atual[k] === "" || atual[k] === false || (Array.isArray(atual[k]) && !atual[k].length)) delete atual[k];
    const itens = { ...c.itens };
    if (Object.keys(atual).length) itens[id] = atual; else delete itens[id];
    return { ...c, itens };
  });
  const emLote = (campos) => mudar((c) => {
    const itens = { ...c.itens };
    for (const id of marcados) {
      const atual = { ...(itens[id] || {}), ...campos };
      for (const k of Object.keys(atual)) if (atual[k] === "" || atual[k] === false) delete atual[k];
      if (Object.keys(atual).length) itens[id] = atual; else delete itens[id];
    }
    // Mover para uma seção do cardápio cria as seções próprias, se ainda não havia.
    return campos.categoria_id && !c.categorias.length ? { ...c, itens, categorias: categorias } : { ...c, itens };
  });
  const setFicha = (fichaId, campos) => setPendentes((p) => ({ ...p, fichas: { ...p.fichas, [fichaId]: { ...(p.fichas[fichaId] || {}), ...campos } } }));
  const setProduto = (id, campos) => setPendentes((p) => ({ ...p, produtos: { ...p.produtos, [id]: { ...(p.produtos[id] || {}), ...campos } } }));

  const nomeSecao = new Map(categorias.map((c) => [c.id, c]));
  const linhas = useMemo(() => juntos.map((p) => {
    const it = config.itens[p.id] || {};
    const catId = categoriaDoProduto(p, categorias, config.itens);
    const cat = nomeSecao.get(catId);
    const motivos = [];
    if (!(centavos(p.preco_venda) > 0)) motivos.push("Sem preço");
    if (!fichaAtiva(p.ficha)) motivos.push("Ficha desativada");
    if (it.oculto) motivos.push("Escondido");
    if (cat && cat.visivel === false) motivos.push("Seção escondida");
    return { p, it, catId, cat, motivos, nome: p.ficha?.nome_comercial || p.nome_produto };
  }), [juntos, config.itens, categorias]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtradas = linhas.filter((l) => {
    if (secao === "_fora" && !l.motivos.length) return false;
    if (secao && secao !== "_fora" && l.catId !== secao) return false;
    const b = normalizarBusca(busca);
    return !b || normalizarBusca(`${l.nome} ${l.p.nome_produto}`).includes(b);
  });
  const fora = linhas.filter((l) => l.motivos.length).length;
  const tudoMarcado = filtradas.length > 0 && filtradas.every((l) => marcados.includes(l.p.id));

  return (
    <div className="space-y-4">
      <Secao titulo="Pratos e drinks" subtitulo="Vêm dos produtos de venda ligados às fichas técnicas. Nome comercial e descrição ficam gravados na ficha; o preço é o do produto.">
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
            <input className={`${inputCls} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato" aria-label="Buscar prato" />
          </label>
          <select className={inputCls} value={secao} onChange={(e) => setSecao(e.target.value)} aria-label="Filtrar por seção">
            <option value="">Todas as seções ({linhas.length})</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="_fora">Fora do cardápio ({fora})</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-hf-elevated/60 p-2">
          <label className="flex min-h-[40px] items-center gap-2 px-1 text-sm font-semibold text-hf-text-2">
            <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={tudoMarcado}
              onChange={() => setMarcados(tudoMarcado ? marcados.filter((id) => !filtradas.some((l) => l.p.id === id)) : [...new Set([...marcados, ...filtradas.map((l) => l.p.id)])])} />
            {marcados.length ? `${marcados.length} marcados` : "Marcar todos"}
          </label>
          {marcados.length ? (
            <>
              <select className={`${inputCls} !w-auto`} value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Mover para a seção">
                <option value="">Mover para…</option>
                {categorias.filter((c) => c.id !== "outros").map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <Botao variante="secundario" disabled={!destino} onClick={() => { emLote({ categoria_id: destino }); setDestino(""); }}>Mover</Botao>
              <Botao variante="secundario" onClick={() => emLote({ destaque: true })}><Star size={16} /> Destacar</Botao>
              <Botao variante="secundario" onClick={() => emLote({ oculto: true })}>Esconder</Botao>
              <Botao variante="secundario" onClick={() => emLote({ oculto: false })}>Mostrar</Botao>
              <Botao variante="texto" onClick={() => setMarcados([])}>Desmarcar</Botao>
            </>
          ) : null}
        </div>

        <ul className="mt-3 divide-y divide-hf-border rounded-xl border border-hf-border">
          {filtradas.map(({ p, it, catId, cat, motivos, nome }) => {
            const pend = pendentes.produtos[p.id];
            const foto = pend && "imagem_url" in pend ? pend.imagem_url : p.imagem_url;
            const fotoFicha = p.ficha?.imagem_url;
            const abertoAgora = aberto === p.id;
            const pf = p.ficha ? pendentes.fichas[p.ficha.id] || {} : {};
            return (
              <li key={p.id} className="min-w-0">
                <div className="flex items-center gap-2 p-2">
                  <input type="checkbox" className="h-5 w-5 flex-shrink-0 accent-[rgb(var(--hf-accent))]" aria-label={`Marcar ${nome}`}
                    checked={marcados.includes(p.id)} onChange={() => setMarcados((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id]))} />
                  <button type="button" onClick={() => setAberto(abertoAgora ? null : p.id)} aria-expanded={abertoAgora}
                    className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 text-left">
                    {foto || fotoFicha
                      ? <img src={foto || fotoFicha} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg border border-hf-border object-cover" loading="lazy" />
                      : <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-dashed border-hf-border text-[10px] text-hf-muted">sem foto</span>}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {it.destaque ? <Star size={14} className="flex-shrink-0 fill-hf-warning text-hf-warning" aria-label="Destaque" /> : null}
                        <span className="truncate text-sm font-semibold text-hf-text">{nome}</span>
                      </span>
                      <span className="block truncate text-xs text-hf-muted">
                        {formatarPreco(p.preco_venda)} · {cat?.nome || "Outros"}{motivos.length ? ` · ` : ""}
                        {motivos.length ? <span className="font-semibold text-hf-warning">{motivos.join(", ")}</span> : null}
                      </span>
                    </span>
                    {abertoAgora ? <ChevronUp size={18} className="text-hf-muted" /> : <ChevronDown size={18} className="text-hf-muted" />}
                  </button>
                </div>
                {abertoAgora ? (
                  <div className="grid gap-3 border-t border-hf-border bg-hf-bg/40 p-3 sm:grid-cols-2">
                    {motivos.includes("Sem preço") ? <Aviso tipo="alerta" className="sm:col-span-2">Sem preço de venda, o prato não aparece nem pode ser pedido. O preço é o do produto: ajuste em Produtos.</Aviso> : null}
                    {motivos.includes("Ficha desativada") ? <Aviso tipo="alerta" className="sm:col-span-2">A ficha técnica deste prato está desativada; ele não aparece no cardápio.</Aviso> : null}
                    {p.ficha ? (
                      <Campo rotulo="Nome no cardápio" dica={`Fica na ficha técnica. No caixa continua “${p.nome_produto}”.`} className="sm:col-span-2">
                        <input className={inputCls} maxLength={80} placeholder={p.nome_produto}
                          value={"nome_comercial" in pf ? pf.nome_comercial : p.ficha.nome_comercial || ""}
                          onChange={(e) => setFicha(p.ficha.id, { nome_comercial: e.target.value })} />
                      </Campo>
                    ) : null}
                    <Campo rotulo="Descrição" className="sm:col-span-2"
                      dica={p.ficha ? "Gravada na ficha técnica (descrição comercial)." : "Este produto não tem ficha técnica: a descrição fica só no cardápio."}>
                      <textarea className={`${inputCls} min-h-[88px] py-2`} maxLength={280} placeholder="O que vem no prato, como é feito, para quantos serve"
                        value={p.ficha ? ("descricao_comercial" in pf ? pf.descricao_comercial : p.ficha.descricao_comercial || "") : it.descricao || ""}
                        onChange={(e) => (p.ficha ? setFicha(p.ficha.id, { descricao_comercial: e.target.value }) : setItem(p.id, { descricao: e.target.value }))} />
                    </Campo>
                    <div className="sm:col-span-2">
                      <Envio rotulo="Foto do prato" url={foto || ""} unidadeId={unidadeId} pasta="pratos"
                        onEnviado={(url) => setProduto(p.id, { imagem_url: url })} onRemover={() => setProduto(p.id, { imagem_url: "" })} />
                      {!foto && fotoFicha ? <p className="mt-1 text-[11px] text-hf-muted">Usando a foto da ficha técnica. Uma foto aqui fica no lugar dela.</p> : null}
                    </div>
                    <Campo rotulo="Seção">
                      <select className={inputCls} value={catId === "outros" && !categorias.some((c) => c.id === "outros") ? "" : catId}
                        onChange={(e) => {
                          const id = e.target.value;
                          mudar((c) => (!c.categorias.length && id ? { ...c, categorias } : c));
                          setItem(p.id, { categoria_id: id });
                        }}>
                        {categorias.filter((c) => c.id !== "outros").map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </Campo>
                    <Campo rotulo="Vai bem com (opcional)">
                      <input className={inputCls} maxLength={140} value={it.harmoniza || ""} onChange={(e) => setItem(p.id, { harmoniza: e.target.value })} placeholder="Ex.: cachaça de jambu" />
                    </Campo>
                    <div className="sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-hf-text-2">Selos</span>
                      <div className="flex flex-wrap gap-1.5">
                        {SELOS.map((s) => {
                          const ativo = (it.selos || []).includes(s.id);
                          return <Chip key={s.id} ativo={ativo} onClick={() => setItem(p.id, { selos: ativo ? it.selos.filter((x) => x !== s.id) : [...(it.selos || []), s.id] })}>{s.rotulo}</Chip>;
                        })}
                      </div>
                      <p className="mt-1 text-[11px] text-hf-muted">“Sem glúten” e “Sem lactose” são declaração da casa: a conversa sempre pede ao cliente com alergia para confirmar com a equipe.</p>
                    </div>
                    <Alternar ativo={Boolean(it.destaque)} onChange={(v) => setItem(p.id, { destaque: v })} rotulo="A casa indica" dica="Aparece no topo e na conversa." />
                    <Alternar ativo={Boolean(it.oculto)} onChange={(v) => setItem(p.id, { oculto: v })} rotulo="Esconder do cardápio" dica="Continua no caixa; só sai do cardápio." />
                    <div className="space-y-1 text-xs text-hf-text-2 sm:col-span-2">
                      <p><strong>Preço:</strong> {formatarPreco(p.preco_venda)} (do produto de venda).</p>
                      <p><strong>Alergênicos da ficha:</strong> {p.ficha ? (p.ficha.alergenicos.length ? p.ficha.alergenicos.join(", ") : "nenhum registrado") : "sem ficha técnica"}{p.ficha?.pode_conter ? ` · pode conter: ${p.ficha.pode_conter}` : ""}.</p>
                      <p className="flex flex-wrap gap-3 pt-1">
                        {p.ficha ? <Link href={`/dashboard/operacao/fichas/${p.ficha.id}`} className="inline-flex min-h-[40px] items-center gap-1 font-semibold text-hf-accent hover:underline">Abrir a ficha técnica <ExternalLink size={14} /></Link> : null}
                        <Link href="/dashboard/operacao/produtos" className="inline-flex min-h-[40px] items-center gap-1 font-semibold text-hf-accent hover:underline">Preço em Produtos <ExternalLink size={14} /></Link>
                      </p>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
          {!filtradas.length ? <li className="p-4 text-sm text-hf-muted">Nenhum prato com esse filtro.</li> : null}
        </ul>
      </Secao>

      {fichasSemProduto.length ? (
        <Secao titulo={`Fichas técnicas sem produto de venda (${fichasSemProduto.length})`}
          subtitulo="Estas receitas existem na cozinha mas não são vendidas: não entram no caixa nem no cardápio. Crie o produto de venda para que apareçam.">
          <ul className="divide-y divide-hf-border rounded-xl border border-hf-border">
            {fichasSemProduto.map((f) => {
              const preco = precos[f.id] ?? (Number(f.preco_venda) > 0 ? String(f.preco_venda).replace(".", ",") : "");
              return (
                <li key={f.id} className="flex flex-wrap items-end gap-2 p-3">
                  <span className="min-w-[160px] flex-1">
                    <span className="block text-sm font-semibold text-hf-text">{f.nome_comercial || f.nome_receita}</span>
                    <span className="block text-xs text-hf-muted">{f.departamento === "bar" ? "Bar" : "Cozinha"}{f.categoria ? ` · ${f.categoria}` : ""}</span>
                  </span>
                  <Campo rotulo="Preço de venda" className="w-32">
                    <input className={`${inputCls} tabular-nums`} inputMode="decimal" value={preco} placeholder="0,00"
                      onChange={(e) => setPrecos((m) => ({ ...m, [f.id]: e.target.value.replace(/[^0-9,.]/g, "") }))} />
                  </Campo>
                  <Botao disabled={criando === f.id} onClick={async () => {
                    setCriando(f.id);
                    const valor = Number(String(preco).replace(/\./g, "").replace(",", "."));
                    const r = await onCriarProduto(f, valor);
                    setCriando("");
                    setErroCriar((m) => ({ ...m, [f.id]: r.erro || "" }));
                  }}>{criando === f.id ? "Criando…" : "Criar produto de venda"}</Botao>
                  {erroCriar[f.id] ? <p className="w-full text-xs font-semibold text-hf-danger">{erroCriar[f.id]}</p> : null}
                </li>
              );
            })}
          </ul>
        </Secao>
      ) : null}
    </div>
  );
}
