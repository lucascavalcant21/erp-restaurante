"use client";

// Painel → Editar produto (protótipo PainelProduto, 9K.1). Cada coisa é gravada
// no seu dono (cardapio-painel-dados.js → salvarProdutoDoPainel): nome,
// descrição e tempo na ficha técnica; capa no produto de venda; fotos/vídeo,
// categoria, canais, horário, "esgotado hoje" e grupos na vitrine do cardápio.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../../../context/ERPContext";
import { TemaCardapio } from "../../../../../components/cardapio-digital/ui";
import PainelProduto from "../../../../../components/cardapio-digital/painel/PainelProduto";
import { categoriasEfetivas, juntarProdutosEFichas, normalizarConfigCardapio } from "../../../../../lib/cardapio-digital.mjs";
import { errosDoFormulario, formularioDoProduto, itemDoFormulario, traducoesDoProduto, usosDosGrupos } from "../../../../../lib/cardapio-painel.mjs";
import { setorDoProduto } from "../../../../../lib/kds-fila.mjs";
import { carregarPainelCardapio, lerAlergenicosDaFicha, salvarProdutoDoPainel } from "../../../../../lib/cardapio-painel-dados";
import { enviarArquivoCardapio } from "../../../../../lib/cardapio-editor";

const LISTA = "/dashboard/operacao/cardapio/produtos";
const EDITOR = "/dashboard/operacao/cardapio";
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function EditarProdutoPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [alerg, setAlerg] = useState({ alergenicos: [], podeConter: "" });
  const [form, setForm] = useState(null);
  const [inicial, setInicial] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState([]);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const r = await carregarPainelCardapio(unidadeAtiva);
    if (r.erro) { setErro(r.erro); return; }
    const produto = r.produtos.find((p) => String(p.id) === String(id));
    if (!produto) { setErro("Produto não encontrado nesta unidade (ou está inativo)."); return; }
    const ficha = r.fichas.find((f) => String(f.id) === String(produto.ficha_id)) || null;
    const cfg = normalizarConfigCardapio(r.config);
    const categorias = categoriasEfetivas(cfg, juntarProdutosEFichas(r.produtos, r.fichas));
    const f = formularioDoProduto({ produto, ficha, config: cfg, categorias });
    setDados({ ...r, produto, ficha, categorias });
    setForm(f);
    setInicial(f);
    setGrupos(cfg.grupos);
    setErro("");
    setAlerg(await lerAlergenicosDaFicha(unidadeAtiva, ficha?.id));
  }, [unidadeAtiva, id]);
  useEffect(() => { carregar(); }, [carregar]);

  const traducoes = useMemo(() => (dados && form
    ? traducoesDoProduto(dados.config, { id: String(id), temDescricao: !!form.descricao.trim() })
    : []), [dados, form, id]);

  async function salvar() {
    const temFicha = !!dados.ficha;
    const problemas = errosDoFormulario(form, { temFicha });
    if (problemas.length) { setErros(problemas); return; }
    setSalvando(true);
    setErros([]);
    const ficha = {};
    if (temFicha) {
      if (form.nome.trim() !== inicial.nome.trim()) ficha.nome_comercial = form.nome.trim();
      if (form.descricao.trim() !== inicial.descricao.trim()) ficha.descricao_comercial = form.descricao.trim() || null;
      if (form.tempo !== inicial.tempo) ficha.tempo_preparo = form.tempo ? Number(form.tempo) : null;
    }
    const capa = form.midias.find((m) => m.tipo === "foto")?.url || "";
    const capaAntes = inicial.midias.find((m) => m.tipo === "foto")?.url || "";
    const r = await salvarProdutoDoPainel(unidadeAtiva, {
      produtoId: String(id),
      fichaId: dados.ficha?.id,
      ficha,
      imagemUrl: capa !== capaAntes ? capa : undefined,
      mudarItem: (item) => itemDoFormulario(item, form, { temFicha, categoriaOriginal: inicial.categoria_id }),
      grupos: igual(grupos, normalizarConfigCardapio(dados.config).grupos) ? undefined : grupos,
    });
    setSalvando(false);
    if (r.erros.length) { setErros(r.erros); return; }
    router.push(LISTA);
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <TemaCardapio><p style={{ padding: 24 }}>Escolha uma unidade no topo para editar o cardápio dela.</p></TemaCardapio>;
  }
  if (!form) {
    return (
      <TemaCardapio>
        <p role={erro ? "alert" : undefined} style={{ padding: 24 }}>{erro || "Carregando o produto…"}{erro ? <> <a href={LISTA}>Voltar ao cardápio</a></> : null}</p>
      </TemaCardapio>
    );
  }
  return (
    <TemaCardapio style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
      <PainelProduto
        nomeLoja={unidadeInfo?.nome_fantasia || unidadeInfo?.nome || ""}
        produto={dados.produto}
        temFicha={!!dados.ficha}
        form={form}
        setForm={setForm}
        categorias={dados.categorias}
        estacao={setorDoProduto(dados.ficha?.departamento || dados.produto.departamento)}
        alergenicos={alerg.alergenicos}
        podeConter={alerg.podeConter}
        grupos={grupos}
        setGrupos={setGrupos}
        usos={usosDosGrupos(dados.config)}
        traducoes={traducoes}
        onSalvar={salvar}
        salvando={salvando}
        erros={erros}
        onEnviarArquivo={(f) => enviarArquivoCardapio(unidadeAtiva, f, `produtos/${id}`)}
        links={{
          voltar: LISTA,
          produtosDeVenda: "/dashboard/operacao/produtos",
          idiomas: `${EDITOR}?aba=idiomas`,
          ficha: dados.ficha ? "/dashboard/operacao/fichas" : "",
        }}
      />
    </TemaCardapio>
  );
}
