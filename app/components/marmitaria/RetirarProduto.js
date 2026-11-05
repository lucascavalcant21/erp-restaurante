"use client";

// Retirada do estoque da marmitaria pelo motor oficial (estoque_movimentar).

import { useState } from "react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, inputCls, lerNumero, num } from "./ui";
import { novaChave, retirarDoEstoque } from "../../lib/marmitaria/dados";
import { fatorSaldo } from "../../lib/marmitaria/nucleo.mjs";

const MOTIVOS = [["consumo", "Uso na cozinha"], ["perda", "Perda"], ["vencimento", "Vencido"]];

export default function RetirarProduto({ item, onFechar }) {
  const { unidadeId, recarregar } = useMarmitaria();
  const un = String(item.ins?.unidade_medida || "un").toLowerCase();
  const [chave] = useState(() => novaChave());
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("consumo");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const valor = lerNumero(qtd);

  async function retirar() {
    if (salvando) return;
    if (!(valor > 0)) return setErro("Informe a quantidade.");
    if (valor > item.saldo) return setErro(`Só há ${num(item.saldo)} ${un} neste estoque.`);
    setSalvando(true); setErro(null);
    try {
      const r = await retirarDoEstoque({ unidadeId, estoqueId: item.estoque_id, insumoId: item.ins.id, quantidadeSaldo: Math.round(valor * fatorSaldo(item.ins) * 1000) / 1000, quantidade: valor, unidade: un, motivo, chave });
      if (r.error) { setErro(r.error); return; }
      await recarregar();
      onFechar();
    } finally { setSalvando(false); }
  }

  return (
    <Secao titulo={`Retirar ${item.ins?.nome || "produto"}`} subtitulo={`Saldo: ${num(item.saldo)} ${un}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo={`Quantidade (${un})`}><CampoNumero valor={qtd} onChange={setQtd} /></Campo>
        <Campo rotulo="Motivo"><select className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></Campo>
      </div>
      {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" type="button" onClick={onFechar}>Cancelar</Botao>
        <Botao type="button" onClick={retirar} disabled={salvando}>{salvando ? "Retirando…" : "Retirar"}</Botao>
      </div>
    </Secao>
  );
}
