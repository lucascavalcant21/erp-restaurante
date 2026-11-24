"use client";

// Repesagem do fim do dia (dono, 17/11/2026: "no final do dia eu faço a
// repesagem, dou baixa no sistema e ele mostra quantas porções eu tenho").
// A pessoa digita quanto pesou; a diferença sai do estoque como uso na cozinha
// pelo motor oficial (estoque_movimentar). Peso maior que o saldo não vira
// entrada: entrada vem de Compras.

import { useState } from "react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, lerNumero, num } from "./ui";
import { novaChave, retirarDoEstoque } from "../../lib/marmitaria/dados";
import { fatorSaldo } from "../../lib/marmitaria/nucleo.mjs";
import { baixaDaRepesagem, porcoesDoSaldo } from "../../lib/marmitaria/porcoes.mjs";

export default function Repesar({ item, onFechar }) {
  const { unidadeId, recarregar } = useMarmitaria();
  const un = String(item.ins?.unidade_medida || "un").toLowerCase();
  const [chave] = useState(() => novaChave());
  const [peso, setPeso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const pesado = lerNumero(peso);
  const conta = peso === "" ? null : baixaDaRepesagem(item.saldo, pesado);
  const porcoesDepois = item.porcao && pesado >= 0 && peso !== "" ? porcoesDoSaldo(pesado, item.porcao) : null;

  async function confirmar() {
    if (salvando || !conta || conta.erro) return setErro(conta?.erro || "Informe quanto pesou agora.");
    if (conta.baixa <= 0) { onFechar(); return; }
    setSalvando(true); setErro(null);
    try {
      const r = await retirarDoEstoque({
        unidadeId, estoqueId: item.estoque_id, insumoId: item.ins.id,
        quantidadeSaldo: Math.round(conta.baixa * fatorSaldo(item.ins) * 1000) / 1000, quantidade: conta.baixa, unidade: un,
        motivo: "consumo", chave,
      });
      if (r.error) { setErro(r.error); return; }
      await recarregar();
      onFechar();
    } finally { setSalvando(false); }
  }

  return (
    <Secao titulo={`Repesar ${item.ins?.nome || "produto"}`} subtitulo={`No sistema: ${num(item.saldo)} ${un}. Pese o que sobrou e digite aqui.`}>
      <div className="max-w-xs">
        <Campo rotulo={`Pesou agora (${un})`}><CampoNumero valor={peso} onChange={setPeso} placeholder="Ex.: 2,4" /></Campo>
      </div>
      {conta && !conta.erro && (
        <p className="mt-3 text-sm text-hf-text">
          Baixa de uso do dia: <b className="tabular-nums">{num(conta.baixa)} {un}</b>
          {porcoesDepois !== null && <> · fica com <b className="tabular-nums">{num(porcoesDepois)}</b> porções</>}
        </p>
      )}
      {(erro || conta?.erro) && <Aviso tipo="alerta" className="mt-3">{erro || conta.erro}</Aviso>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" type="button" onClick={onFechar}>Cancelar</Botao>
        <Botao type="button" onClick={confirmar} disabled={salvando || !conta || !!conta.erro}>{salvando ? "Dando baixa…" : "Dar baixa"}</Botao>
      </div>
    </Secao>
  );
}
