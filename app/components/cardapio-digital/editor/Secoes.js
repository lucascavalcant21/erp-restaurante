"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { LIMITES, PAPEIS_CATEGORIA, categoriaDoProduto, categoriasEfetivas, gerarId } from "../../../lib/cardapio-digital.mjs";
import { Alternar, Aviso, Botao, Campo, Envio, Secao, inputCls, mover } from "./ui";

export default function Secoes({ config, mudar, unidadeId, produtos }) {
  const [nova, setNova] = useState("");
  const [aberta, setAberta] = useState(null);
  const proprias = config.categorias.length > 0;
  const lista = categoriasEfetivas(config, produtos);
  const contagem = new Map();
  for (const p of produtos) {
    const id = categoriaDoProduto(p, lista, config.itens);
    contagem.set(id, (contagem.get(id) || 0) + 1);
  }
  const setCats = (fn) => mudar((c) => ({ ...c, categorias: fn(c.categorias.length ? c.categorias : lista) }));
  const editar = (id, campos) => setCats((l) => l.map((x) => (x.id === id ? { ...x, ...campos } : x)));

  const adicionar = () => {
    const nome = nova.trim().slice(0, 40);
    if (!nome) return;
    setCats((l) => [...l, { id: gerarId("cat", l.map((x) => x.id)), nome, descricao: "", imagem_url: "", visivel: true, papel: "comida" }]);
    setNova("");
  };

  return (
    <div className="space-y-4">
      <Secao titulo="Seções do cardápio" subtitulo="Começam iguais às categorias das fichas técnicas. Aqui você renomeia, muda a ordem, cria novas e esconde as que não quer mostrar — sem mexer na ficha.">
        {!proprias ? (
          <Aviso>Usando as categorias das fichas técnicas. Qualquer mudança abaixo passa a valer só para o cardápio.</Aviso>
        ) : null}
        <ul className="mt-3 space-y-2">
          {lista.map((c, i) => (
            <li key={c.id} className="rounded-xl border border-hf-border">
              <div className="flex items-center gap-2 p-2 pl-3">
                <button type="button" className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setAberta(aberta === c.id ? null : c.id)} aria-expanded={aberta === c.id}>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-bold ${c.visivel ? "text-hf-text" : "text-hf-muted line-through"}`}>{c.nome}</span>
                    <span className="block text-xs text-hf-muted">{contagem.get(c.id) || 0} pratos · {PAPEIS_CATEGORIA.find((p) => p.id === c.papel)?.rotulo}{c.visivel ? "" : " · escondida"}</span>
                  </span>
                  {aberta === c.id ? <ChevronUp size={18} className="text-hf-muted" /> : <ChevronDown size={18} className="text-hf-muted" />}
                </button>
                <Botao variante="secundario" onClick={() => setCats((l) => mover(l, i, -1))} disabled={i === 0} aria-label={`Subir ${c.nome}`}><ArrowUp size={16} /></Botao>
                <Botao variante="secundario" onClick={() => setCats((l) => mover(l, i, 1))} disabled={i === lista.length - 1} aria-label={`Descer ${c.nome}`}><ArrowDown size={16} /></Botao>
              </div>
              {aberta === c.id ? (
                <div className="grid gap-3 border-t border-hf-border p-3 sm:grid-cols-2">
                  <Campo rotulo="Nome no cardápio"><input className={inputCls} value={c.nome} maxLength={40} onChange={(e) => editar(c.id, { nome: e.target.value })} /></Campo>
                  <Campo rotulo="Tipo" dica="Ajuda a conversa e a sugestão do pedido (bebida, sobremesa).">
                    <select className={inputCls} value={c.papel} onChange={(e) => editar(c.id, { papel: e.target.value })}>
                      {PAPEIS_CATEGORIA.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Frase da seção (opcional)" className="sm:col-span-2">
                    <input className={inputCls} value={c.descricao} maxLength={140} onChange={(e) => editar(c.id, { descricao: e.target.value })} placeholder="Ex.: Tudo feito na brasa, na hora" />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Envio rotulo="Foto da seção (opcional)" url={c.imagem_url} unidadeId={unidadeId} pasta="secoes" compacto
                      onEnviado={(url) => editar(c.id, { imagem_url: url })} onRemover={() => editar(c.id, { imagem_url: "" })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Alternar ativo={c.visivel} onChange={(v) => editar(c.id, { visivel: v })} rotulo="Mostrar no cardápio" dica="Escondida, os pratos dela também somem do cardápio." />
                  </div>
                  {c.id !== "outros" ? (
                    <Botao variante="perigo" className="sm:col-span-2" onClick={() => setCats((l) => l.filter((x) => x.id !== c.id))}>
                      <Trash2 size={16} /> Apagar a seção (os pratos dela voltam para a seção da ficha ou vão para Outros)
                    </Botao>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {lista.length < LIMITES.categorias ? (
          <div className="mt-3 flex gap-2">
            <input className={inputCls} value={nova} maxLength={40} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} placeholder="Nova seção (ex.: Para dividir)" aria-label="Nome da nova seção" />
            <Botao onClick={adicionar} disabled={!nova.trim()}><Plus size={16} /> Criar</Botao>
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-hf-muted">Para levar pratos para uma seção, use a aba Pratos (dá para escolher vários de uma vez).</p>
        {proprias ? (
          <Botao variante="texto" className="mt-2" onClick={() => mudar((c) => ({ ...c, categorias: [] }))}>Voltar às categorias das fichas técnicas</Botao>
        ) : null}
      </Secao>
    </div>
  );
}
