"use client";

// Painel → Fidelidade e selos (protótipo PainelFidelidade, 9N). Valida o
// código de prêmio que o cliente mostra (o banco confere e dá baixa:
// FIDELIDADE-2), grava a regra de pontos/cashback e os canais, e mostra os
// cartões e as retiradas. O balcão (buscar cliente pelo WhatsApp, lançar
// selo, usar cashback) continua em Clientes → Fidelidade.

import { useCallback, useEffect, useState } from "react";
import { useERP } from "../../../../context/ERPContext";
import { TemaCardapio } from "../../../../components/cardapio-digital/ui";
import PainelFidelidade, { resultadoDoCodigo } from "../../../../components/cardapio-digital/painel/PainelFidelidade";
import { carregarPainelFidelidade, confirmarPremio, salvarRegrasFidelidade, validarPremio } from "../../../../lib/fidelidade-painel";

const SEM_PREMIOS = "O código de prêmio ainda não está ligado no banco (atualização FIDELIDADE-2 pendente). Enquanto isso, entregue o prêmio pela busca do cliente em Clientes → Fidelidade.";

export default function PainelFidelidadePage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null);
  const [regras, setRegras] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    const r = await carregarPainelFidelidade(unidadeAtiva);
    if (r.erro) { setErro(r.erro); setDados(null); return; }
    setErro("");
    setDados(r);
    setRegras(r.config);
  }, [unidadeAtiva]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);

  const validar = async () => {
    setOcupado(true);
    setAviso("");
    const r = await validarPremio(unidadeAtiva, codigo);
    setOcupado(false);
    if (r.erro === "sem_premios") { setResultado(null); setAviso(SEM_PREMIOS); return; }
    if (r.erro) { setErro(r.erro); setResultado(null); return; }
    setErro("");
    setResultado(resultadoDoCodigo(r.dados));
  };
  const confirmar = async () => {
    setOcupado(true);
    const r = await confirmarPremio(unidadeAtiva, codigo);
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setErro("");
    setResultado({ pode: false, titulo: "Retirada confirmada", detalhe: "O prêmio saiu do cartão do cliente e entrou nas retiradas." });
    setCodigo("");
    carregar();
  };
  const salvarRegras = async () => {
    setOcupado(true);
    const r = await salvarRegrasFidelidade(unidadeAtiva, (atual) => ({ ...atual, ativo: regras.ativo, canais: regras.canais, cashback: { ...atual.cashback, ...regras.cashback } }));
    setOcupado(false);
    if (r.erro) { setErro(r.erro); return; }
    setErro("");
    setDados((d) => ({ ...d, config: r.config }));
    setRegras(r.config);
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <TemaCardapio><p style={{ padding: 24 }}>Escolha uma unidade no topo para ver a fidelidade dela.</p></TemaCardapio>;
  }
  if (!dados || !regras) {
    return <TemaCardapio><p role={erro ? "alert" : undefined} style={{ padding: 24 }}>{erro || "Carregando a fidelidade…"}</p></TemaCardapio>;
  }
  const mudou = JSON.stringify({ a: regras.ativo, c: regras.canais, b: regras.cashback }) !== JSON.stringify({ a: dados.config.ativo, c: dados.config.canais, b: dados.config.cashback });
  return (
    <TemaCardapio style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
      <PainelFidelidade
        nomeLoja={unidadeInfo?.nome_fantasia || unidadeInfo?.nome || ""}
        codigo={codigo}
        onCodigo={(v) => { setCodigo(v); setResultado(null); }}
        onValidar={validar}
        resultado={resultado}
        onConfirmar={confirmar}
        ocupado={ocupado}
        regras={regras}
        setRegras={setRegras}
        onSalvarRegras={salvarRegras}
        regrasMudaram={mudou}
        cartoes={dados.config.cartoes}
        numeros={dados.numeros}
        retiradas={dados.retiradas}
        premiosLigados={dados.premiosLigados}
        ligado={dados.config.ativo}
        erro={erro}
        aviso={aviso || (!dados.config.ativo ? "O programa de fidelidade está desligado: ligue o cashback aqui ou os cartões em Configurar cartões." : "")}
        linkCartoes="/dashboard/operacao/cardapio?aba=fidelidade"
      />
    </TemaCardapio>
  );
}
