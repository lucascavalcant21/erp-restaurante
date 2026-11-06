"use client";

// Depois de lançar no estoque: a etiqueta sai sozinha e o botão fica para repetir.

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { Aviso, Botao, Secao, num } from "./ui";
import { imprimirEtiquetas, registrarEtiquetas } from "../../lib/marmitaria/imprimir-etiquetas";

const MENSAGEM = {
  usb: "Etiquetas enviadas para a impressora.",
  bluetooth: "Etiquetas enviadas para a impressora Bluetooth.",
  navegador: "A impressão do aparelho foi aberta.",
};

export default function EtiquetasProntas({ lista, unidadeId, recebidoEm, onFechar }) {
  const { sessao } = useERP();
  const [prontas, setProntas] = useState(null);
  const [estado, setEstado] = useState(null);
  const [imprimindo, setImprimindo] = useState(true);
  const iniciado = useRef(false);
  const opcoes = { unidadeId, unidadeNome: "Marmitaria", responsavel: sessao?.nome || "", recebidoEm };

  async function imprimir(comRegistro, pedirPermissao) {
    setImprimindo(true);
    try {
      const alvo = comRegistro ? await registrarEtiquetas(lista, { unidadeId, responsavel: opcoes.responsavel, usuario: sessao }) : prontas;
      setProntas(alvo);
      setEstado(await imprimirEtiquetas(alvo, { ...opcoes, pedirPermissao }));
    } finally { setImprimindo(false); }
  }

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    imprimir(true, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = lista.reduce((s, e) => s + e.copias, 0);
  return (
    <Secao titulo="Etiquetas do que chegou" subtitulo={`${total} etiqueta${total > 1 ? "s" : ""} de ${lista.length} produto${lista.length > 1 ? "s" : ""}.`}>
      <ul className="divide-y divide-hf-border">
        {lista.map((e) => (
          <li key={`${e.produto}-${e.validade}`} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 font-bold text-hf-text">{e.produto}</span>
            <span className="shrink-0 text-hf-text-2">{num(e.quantidade)} {e.unidade} · {e.copias}×</span>
          </li>
        ))}
      </ul>
      {imprimindo && <p className="mt-2 text-sm text-hf-muted">Imprimindo…</p>}
      {!imprimindo && estado && <p className="mt-2 text-sm font-bold text-hf-text">{MENSAGEM[estado.via]}</p>}
      {!imprimindo && estado?.error && <Aviso tipo="alerta" className="mt-2">{estado.error}</Aviso>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao type="button" disabled={imprimindo || !prontas} onClick={() => imprimir(false, true)}><Printer size={16} /> Imprimir de novo</Botao>
        <Botao type="button" variante="secundario" onClick={onFechar}>Fechar</Botao>
      </div>
    </Secao>
  );
}
