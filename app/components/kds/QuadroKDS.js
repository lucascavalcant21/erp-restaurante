"use client";

import { AlertTriangle, ArrowLeft, Check, Printer, Timer, Volume2, VolumeX } from "lucide-react";
import { clienteDoTicket, localDoTicket, partesDoItem } from "../../lib/kds-fila.mjs";
import s from "./kds.module.css";

// Quadro do KDS (protótipo KDS, 9D): Na fila → Em preparo → Prontos. Só
// desenha; quem lê o banco, muda o estado e imprime é a página
// (dashboard/cozinha/kds). Prioridade = passou do prazo da estação.

const CANAL = { qrcode: "QR mesa", salao: "Garçom", delivery: "Delivery", retirada: "Retirada", ifood: "iFood", balcao: "Balcão" };
const horaDe = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
const numeroDe = (id) => `#${String(id || "").slice(0, 4).toUpperCase()}`;

function Card({ t, coluna, impressoEm, onIniciar, onPronto, onReimprimir, onEntregue }) {
  const local = localDoTicket(t);
  const cliente = clienteDoTicket(t);
  const itens = t.itens.map((i) => ({ ...i, partes: partesDoItem(i.observacao) }));
  const alergias = [...new Set(itens.flatMap((i) => i.partes.alergia))];
  const cabeca = coluna === "fila" ? s.cabecaFila : coluna === "preparo" ? s.cabecaPreparo : s.cabecaPronto;
  const corTempo = t.relogio.cor === "atrasado" ? s.tempoAtrasado : t.relogio.cor === "atencao" ? s.tempoAtencao : s.tempoOk;
  return (
    <article className={`${s.card} ${t.prioridade ? `${s.cardPrioridade} ${s[`p${t.relogio.nivel}`]}` : ""}`}
      aria-label={`${numeroDe(t.id)} ${local}${t.prioridade ? `, prioridade ${t.prioridade}` : ""}`}>
      {t.prioridade ? (
        <div className={s.faixa}>
          <span className={s.faixaTitulo}><AlertTriangle size={15} aria-hidden="true" />PRIORIDADE {t.prioridade}</span>
          <span>Atrasado há {t.relogio.atraso} min</span>
        </div>
      ) : null}
      <div className={`${s.cabeca} ${cabeca}`}>
        <div>
          <span className={s.numero}>{numeroDe(t.id)} · {local}</span>
          <span className={s.sub}>{CANAL[t.tipo_pedido] || "Salão"}{cliente ? ` · ${cliente}` : ""} · chegou {horaDe(t.created_at)}</span>
        </div>
        <span className={`${s.tempo} ${coluna === "pronto" ? s.tempoOk : corTempo}`}>
          <Timer size={16} aria-hidden="true" />{coluna === "pronto" ? `Pronto ${horaDe(t.prontoEm)}` : t.relogio.texto}
        </span>
      </div>
      <div className={s.corpo}>
        {alergias.length ? <div className={s.alergia}><AlertTriangle size={15} aria-hidden="true" />{alergias.join(" · ")}</div> : null}
        {itens.map((i) => (
          <div key={i.id} className={s.item}>
            <div className={s.itemLinha}>
              <span className={s.qtd}>{i.quantidade}×</span>
              <span className={s.itemNome}>{i.nome}</span>
              <span className={`${s.etiqueta} ${i.partes.viagem ? s.viagem : s.local}`}>{i.partes.viagem ? "VIAGEM" : "NO LOCAL"}</span>
            </div>
            {i.partes.mods.map((m) => <span key={m} className={s.mod}>{m}</span>)}
            {i.partes.obs ? <span className={s.obs}>Obs: {i.partes.obs}</span> : null}
          </div>
        ))}
        {coluna === "pronto" && impressoEm ? (
          <span className={s.impressa}><Check size={14} aria-hidden="true" />Comanda de entrega impressa {horaDe(impressoEm)} · entregar na {local}</span>
        ) : null}
        <div className={s.acoes}>
          {coluna === "fila" ? <button type="button" className={`${s.acao} ${s.acaoIniciar}`} onClick={() => onIniciar(t)}>Iniciar preparo</button> : null}
          {coluna === "preparo" ? <button type="button" className={`${s.acao} ${s.acaoPronto}`} onClick={() => onPronto(t)}><Printer size={18} aria-hidden="true" />Pronto · imprimir comanda</button> : null}
          {coluna === "pronto" ? (
            <>
              <button type="button" className={`${s.acao} ${s.acaoReimprimir}`} onClick={() => onReimprimir(t)}><Printer size={18} aria-hidden="true" />Reimprimir comanda</button>
              <button type="button" className={`${s.acao} ${s.acaoEntregue}`} onClick={() => onEntregue(t)}><Check size={18} aria-hidden="true" />Entregue</button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const COLUNAS = [
  { id: "fila", titulo: "Na fila", ponto: "pontoFila", vazio: "Nenhum pedido esperando." },
  { id: "preparo", titulo: "Em preparo", ponto: "pontoPreparo", vazio: "Nada no fogo agora." },
  { id: "pronto", titulo: "Prontos", ponto: "pontoPronto", vazio: "Nada pronto para entregar." },
];

export default function QuadroKDS({
  quadro, tempoMedio, agora, estacoes, setor, onSetor, impressos = {}, avisos = [], toast = "",
  somAtivo, onSom, impressaoLigada, onImpressao, onVoltar, onIniciar, onPronto, onReimprimir, onEntregue,
}) {
  return (
    <div className={s.tela}>
      <header className={s.topo}>
        {onVoltar ? <button type="button" className={s.voltar} onClick={onVoltar} aria-label="Voltar"><ArrowLeft size={20} /></button> : null}
        <span className={s.marca}>KDS</span>
        <nav className={s.estacoes} aria-label="Estações">
          {estacoes.map((e) => (
            <button key={e.id} type="button" aria-pressed={setor === e.id} className={`${s.estacao} ${setor === e.id ? s.estacaoSel : ""}`} onClick={() => onSetor(e.id)}>
              {e.nome}<span className={s.estacaoQtd}>{e.qtd}</span>
            </button>
          ))}
        </nav>
        <span className={s.espaco} />
        <span className={s.numeros}>
          <span>Tempo médio <strong>{tempoMedio == null ? "—" : `${tempoMedio} min`}</strong></span>
          <span>Prioridades <strong className={quadro.prioridades ? s.prioridades : ""}>{quadro.prioridades}</strong></span>
        </span>
        <span className={s.relogio}>{new Date(agora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        {onSom ? (
          <button type="button" className={`${s.ferramenta} ${somAtivo ? s.ferramentaLigada : ""}`} onClick={onSom} aria-pressed={somAtivo}>
            {somAtivo ? <Volume2 size={18} /> : <VolumeX size={18} />}Som
          </button>
        ) : null}
        {onImpressao ? (
          <button type="button" className={`${s.ferramenta} ${impressaoLigada ? s.ferramentaLigada : ""}`} onClick={onImpressao}>
            <Printer size={18} />Impressão
          </button>
        ) : null}
      </header>
      {avisos?.length ? (
        <div className={s.avisos}>
          {avisos.map((a) => (a.onClick
            ? <button key={a.texto} type="button" className={s.aviso} onClick={a.onClick}>{a.texto}</button>
            : <p key={a.texto} className={s.aviso} role="alert">{a.texto}</p>))}
        </div>
      ) : null}
      <div className={s.colunas}>
        {COLUNAS.map((c) => (
          <section key={c.id} className={s.coluna} aria-label={c.titulo}>
            <div className={s.colunaTopo}>
              <span className={`${s.ponto} ${s[c.ponto]}`} aria-hidden="true" />
              <h2 className={s.colunaTitulo}>{c.titulo}</h2>
              <span className={s.colunaQtd}>{quadro[c.id].length}</span>
            </div>
            {quadro[c.id].length ? quadro[c.id].map((t) => (
              <Card key={t.id} t={t} coluna={c.id} impressoEm={impressos[t.id]}
                onIniciar={onIniciar} onPronto={onPronto} onReimprimir={onReimprimir} onEntregue={onEntregue} />
            )) : <p className={s.vazio}>{c.vazio}</p>}
          </section>
        ))}
      </div>
      {toast ? <div className={s.toast} role="status">{toast}</div> : null}
    </div>
  );
}
