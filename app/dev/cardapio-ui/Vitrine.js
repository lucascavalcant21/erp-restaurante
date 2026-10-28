"use client";

import { useState } from "react";
import {
  BannerMidia, BarraNavegacao, Botao, BotaoRedondo, Card, CarrosselAgora, ChipCategoria, Chip, ConviteDesconto, Etiqueta,
  FotoPrato, Icone, IndicadorPimenta, PalavraDesconto, Pontos, Preco, Quantidade, Segmentado, Selo, EstadoGrupo, TemaCardapio,
} from "../../components/cardapio-digital/ui";

// Cada amostra fica num quadro com a largura que o componente tem no protótipo
// (data-amostra = nome usado em scripts/cardapio-digital/comparar-base.mjs).
// Textos = os do protótipo aprovado. A foto do Tacacá só aparece se existir em
// public/dev-cardapio/ (fora do Git).

const FOTO_TESTE = "/dev-cardapio/tacaca.jpg";

function Quadro({ id, titulo, largura, fundo = "#FFFFFF", respiro, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ font: "600 12px/1.4 system-ui", color: "#5C5C5C", margin: "0 0 6px" }}>{titulo}</div>
      <div style={{ boxSizing: "border-box", width: largura, background: fundo, padding: respiro, overflow: "hidden" }}>
        <div data-amostra={id}>{children}</div>
      </div>
    </div>
  );
}

export default function Vitrine() {
  const [qtd, setQtd] = useState(1);
  const [consumo, setConsumo] = useState("aqui");
  const [tipo, setTipo] = useState("entrega");
  const [cor, setCor] = useState("#14532D");

  const promosTablet = [
    { id: 1, etiqueta: "Happy hour · 17h–20h", titulo: "Chope em dobro", detalhe: "Pegue 1, leve 2" },
    { id: 2, etiqueta: "Prato do dia", titulo: "Feijoada completa", detalhe: "Só às quartas · R$ 49,90" },
    { id: 3, etiqueta: "Combo", titulo: "Grelhado + drink", detalhe: <>R$ 10 de<PalavraDesconto /></> },
  ];
  const promosCelular = [
    { id: 1, etiqueta: "Terça do Tacacá", titulo: <>Tacacá com 20% de<PalavraDesconto /></>, de: 32, preco: 25.6, foto: FOTO_TESTE },
    { id: 2, etiqueta: "Prato do dia", titulo: "Feijoada completa", preco: 49.9 },
    { id: 3, etiqueta: "Combo", titulo: "Picanha + refri", de: 104.9, preco: 94.9 },
    { id: 4, etiqueta: "Sobremesa", titulo: "Pudim de tapioca", preco: 18 },
    { id: 5, etiqueta: "Happy hour", titulo: "Chope em dobro", preco: 14 },
  ];
  const categorias = [["Destaques", 6], ["Entradas", 9], ["Grelhados", 8], ["Pratos do dia", 3], ["Massas", 7], ["Bebidas", 14], ["Drinks", 11], ["Sobremesas", 6]];

  return (
    <TemaCardapio cor={cor} style={{ minHeight: "100vh", background: "#F2F2F2", padding: 24 }}>
      <h1 style={{ margin: "0 0 4px", font: "700 22px/1.3 system-ui" }}>Cardápio digital — base visual (Etapa 1)</h1>
      <p style={{ margin: "0 0 12px", font: "400 13px/1.5 system-ui", color: "#5C5C5C" }}>
        Só fora de produção. Textos do protótipo aprovado, para comparar com os .dc.html.
      </p>
      <label style={{ display: "inline-flex", gap: 8, alignItems: "center", font: "500 13px system-ui", marginBottom: 20 }}>
        Cor da loja
        <select value={cor} onChange={(e) => setCor(e.target.value)}>
          {["#14532D", "#0F3D2E", "#1E6B45", "#1F5FBF", "#F5C26B"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ color: "#5C5C5C" }}>(#F5C26B não tem contraste com branco: volta para o verde padrão)</span>
      </label>

      <h2 style={{ font: "700 16px system-ui", margin: "8px 0 12px" }}>Tablet (1280 × 800)</h2>
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Quadro id="recomendacoes" titulo="Botão principal (menu lateral)" largura={184} fundo="#F7F7F7">
          <Botao tamanho={52} alinhar="inicio" larguraTotal href="#" icone="estrela" style={{ gap: 10 }}>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, textAlign: "left" }}>
              Recomendações
              <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>O que você quer hoje?</span>
            </span>
          </Botao>
        </Quadro>
        <Quadro id="categorias" titulo="Categorias (menu lateral)" largura={184} fundo="#F7F7F7">
          <nav aria-label="Categorias" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {categorias.map(([nome, n]) => <ChipCategoria key={nome} ativa={nome === "Grelhados"} contador={n} href="#">{nome}</ChipCategoria>)}
          </nav>
        </Quadro>
        <Quadro id="lateral-botoes" titulo="Botões do menu lateral" largura={184} fundo="#F7F7F7">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Botao variante="clara" tamanho={44} alinhar="inicio" icone="alvo" href="#">Menu degustação</Botao>
            <Botao variante="fantasma" tamanho={44} alinhar="inicio" icone="livro" href="#">Nossa história</Botao>
            <Botao variante="secundario" tamanho={48} icone="sino">Chamar garçom</Botao>
            <div style={{ display: "flex", gap: 6 }}>
              <Botao variante="secundario" tamanho={44} href="#" icone="globo" tamanhoIcone={16} style={{ flex: 1, fontSize: 13, gap: 6, padding: 0 }}>Idioma</Botao>
              <Botao variante="secundario" tamanho={44} href="#" icone="wifi" tamanhoIcone={16} style={{ flex: 1, fontSize: 13, gap: 6, padding: 0 }}>Wi-Fi</Botao>
            </div>
          </div>
        </Quadro>
        <Quadro id="redondo" titulo="Fechar e voltar" largura={120}>
          <div style={{ display: "flex", gap: 12 }}>
            <BotaoRedondo tipo="fechar" rotulo="Fechar" href="#" />
            <BotaoRedondo tipo="voltar" rotulo="Voltar" href="#" />
          </div>
        </Quadro>
      </div>

      <Quadro id="banner-tablet" titulo="Banner verde animado — convite (tablet)" largura={1028}>
        <ConviteDesconto
          layout="tablet" percentual="10%" href="#" rotuloAcessivel="Cadastre-se e ganhe 10% de desconto em todos os pratos"
          texto={<>em todos os pratos<br />R$ 1 = 1 ponto</>}
        />
      </Quadro>

      <Quadro id="destaque-midia" titulo="Banner de foto ou vídeo (sem mídia cadastrada)" largura={1028}>
        <BannerMidia
          etiqueta="Especial da casa" titulo="Costela no fogo de chão" texto="12 horas de brasa, servida com mandioca e vinagrete"
          total={4} atual={0} vazio="[VÍDEO OU FOTO DO BANNER — loop sem som]"
        />
      </Quadro>

      <Quadro id="agora-tablet" titulo="Carrossel automático “Agora na casa” (tablet)" largura={1068} respiro="0 20px">
        <CarrosselAgora variante="tablet" nota="Atualiza conforme o horário" itens={promosTablet} />
      </Quadro>

      <Quadro id="card-prato-tablet" titulo="Card de prato (composição: Card + FotoPrato + Etiqueta + Selo + Preço + Botão)" largura={508}>
        <Card href="#" aria-label="Ver Picanha na brasa" style={{ gap: 12, padding: 10 }}>
          <FotoPrato largura={112} altura={112} video />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flexGrow: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Picanha na brasa</span>
            <span style={{ fontSize: 12, lineHeight: 1.4, color: "var(--cd-texto-secundario)" }}>300 g com farofa da casa, vinagrete e mandioca frita.</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <Etiqueta>Glúten</Etiqueta>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
              <Preco valor={89.9} />
              <Botao as="span" tamanho={36} plano>Adicionar</Botao>
            </div>
          </div>
        </Card>
      </Quadro>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Quadro id="selos" titulo="Selos da ficha (verde e amarelo)" largura={708}>
          <div role="list" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Selo tipo="ok" role="listitem">Sem glúten</Selo>
            <Selo tipo="ok" role="listitem">Sem lactose</Selo>
            <Selo tipo="alerta" role="listitem">Contém crustáceos</Selo>
          </div>
        </Quadro>
        <Quadro id="estados" titulo="Estado do grupo" largura={240}>
          <div style={{ display: "flex", gap: 8 }}>
            <EstadoGrupo tipo="ok">✓ Ok</EstadoGrupo>
            <EstadoGrupo tipo="neutro">1 / 2</EstadoGrupo>
            <EstadoGrupo tipo="falta">⚠ Falta 1</EstadoGrupo>
          </div>
        </Quadro>
      </div>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Quadro id="pimenta" titulo="Pimenta (nível 1)" largura={349}>
          <IndicadorPimenta nivel={1} nota="O jambu deixa a boca levemente dormente" />
        </Quadro>
        <Quadro id="pimenta-0" titulo="Pimenta (nível 0)" largura={349}>
          <IndicadorPimenta nivel={0} nota="Pode pedir sem medo" />
        </Quadro>
        <Quadro id="pimenta-3" titulo="Pimenta (nível 3)" largura={349}>
          <IndicadorPimenta nivel={3} nota="Bem picante" />
        </Quadro>
      </div>

      <Quadro id="rodape-detalhe" titulo="Rodapé do detalhe: Segmentado + Quantidade + Botão principal com valor" largura={760}>
        <div style={{ padding: "14px 26px", borderTop: "1px solid var(--cd-divisoria)", display: "flex", gap: 12, alignItems: "center" }}>
          <Segmentado tom="principal" rotulo="Onde vai consumir" largura={220} valor={consumo} onMudar={setConsumo}
            opcoes={[{ id: "aqui", rotulo: "Aqui" }, { id: "viagem", rotulo: "Viagem" }]} />
          <Quantidade valor={qtd} onMudar={setQtd} />
          <Botao tamanho={54} href="#" valor="R$ 40,00" style={{ flexGrow: 1 }}>Adicionar ao pedido</Botao>
        </div>
      </Quadro>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Quadro id="botao-entrar" titulo="Botão principal 56 com DESCONTO" largura={420}>
          <Botao tamanho={56} larguraTotal href="#">Entrar e ganhar 10% de<PalavraDesconto /></Botao>
        </Quadro>
        <Quadro id="botao-recusar" titulo="Botão contorno 64 (recusar com o mesmo peso)" largura={420}>
          <Botao variante="contorno" tamanho={64} larguraTotal href="#">Não, obrigado · quero só pedir</Botao>
        </Quadro>
      </div>

      <h2 style={{ font: "700 16px system-ui", margin: "20px 0 12px" }}>Celular (390 × 844)</h2>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Quadro id="banner-celular" titulo="Banner verde — convite (celular)" largura={358}>
          <ConviteDesconto layout="celular" percentual="10%" href="#" rotuloAcessivel="Cadastre-se e ganhe 10% de desconto em todos os pedidos"
            texto="em todos os pedidos · R$ 1 = 1 ponto" />
          <div style={{ marginTop: 10 }}><Pontos total={3} atual={0} claro centro /></div>
        </Quadro>
        <Quadro id="segmentado-delivery" titulo="Segmentado (Entrega | Retirada)" largura={358}>
          <Segmentado leve rotulo="Tipo de pedido" valor={tipo} onMudar={setTipo}
            opcoes={[{ id: "entrega", rotulo: "Entrega · 40–50 min" }, { id: "retirada", rotulo: "Retirada · a partir de 15 min" }]} />
        </Quadro>
      </div>
      <Quadro id="agora-celular" titulo="Carrossel automático “Agora na casa” (celular)" largura={390} respiro="0 16px">
        <CarrosselAgora variante="celular" link={{ rotulo: "Ver tudo", href: "#" }} itens={promosCelular} />
      </Quadro>
      <Quadro id="chips-delivery" titulo="Chips (busca, Me ajuda a escolher, categorias)" largura={390}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 16px" }}>
          <Botao variante="secundario" tamanho={40} aria-label="Buscar" icone="busca" style={{ width: 44, padding: 0, flexShrink: 0 }} />
          <Chip claro icone="brilho" href="#">Me ajuda a escolher</Chip>
          {["Grelhados", "Pratos do dia", "Massas", "Bebidas"].map((n, i) => <Chip key={n} href="#" selecionado={i === 0}>{n}</Chip>)}
        </div>
      </Quadro>
      <Quadro id="card-prato-celular" titulo="Card de prato do celular" largura={358}>
        <Card href="#" style={{ overflow: "hidden", minHeight: 118 }}>
          <div style={{ flexGrow: 1, minWidth: 0, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Picanha na brasa</span>
            <span style={{ fontSize: 12, lineHeight: 1.4, color: "var(--cd-texto-secundario)" }}>300 g com farofa, vinagrete e mandioca frita.</span>
            <span style={{ marginTop: "auto" }}><Preco valor={89.9} prefixo="A partir de" tamanho={14} principal fonteTexto /></span>
          </div>
          <FotoPrato largura={118} raio={0} video etiquetaPequena style={{ alignSelf: "stretch" }} />
        </Card>
      </Quadro>
      <Quadro id="nav-celular" titulo="Barra de navegação com ícones" largura={390}>
        <BarraNavegacao itens={[
          { rotulo: "Início", href: "#", icone: "casa", atual: true },
          { rotulo: "Pedidos", href: "#", icone: "pedidos" },
          { rotulo: "Descontos", href: "#", icone: "descontos", contador: 2 },
          { rotulo: "Perfil", href: "#", icone: "perfil" },
        ]} />
      </Quadro>
    </TemaCardapio>
  );
}

