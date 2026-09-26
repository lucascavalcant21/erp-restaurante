const fs = require('fs');

const head = fs.readFileSync('head.js', 'utf-8');

const tail = `export default function EtiquetasRapidas() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const [setor, setSetor] = useState("");
  const [funcionarios, setFuncionarios] = useState([]);
  const [responsavelId, setResponsavelId] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [item, setItem] = useState(null);
  const [fila, setFila] = useState([]);
  const [filaImpressao, setFilaImpressao] = useState([]);
  const [nomeLivre, setNomeLivre] = useState("");
  const [criandoLivre, setCriandoLivre] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [tipoEtiqueta, setTipoEtiqueta] = useState("aberto");
  const [modeloEtiqueta, setModeloEtiqueta] = useState("validade");
  const [vozAberta, setVozAberta] = useState(false);
  const [ouvindoVoz, setOuvindoVoz] = useState(false);
  const [textoVoz, setTextoVoz] = useState("");
  const [respostaVoz, setRespostaVoz] = useState("Fale todos os produtos e quantidades em uma unica frase.");
  const escutaVozRef = useRef(null);
  const [listasSalvas, setListasSalvas] = useState([]);
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  const [salvandoLista, setSalvandoLista] = useState(false);
  const [modalSalvarLista, setModalSalvarLista] = useState(false);
  const [nomeNovaLista, setNomeNovaLista] = useState("");
  const [listaParaExcluir, setListaParaExcluir] = useState(null);
  const [bluetoothNome, setBluetoothNome] = useState("");
  const [conectandoBluetooth, setConectandoBluetooth] = useState(false);
  const [tamanho] = useState(() => { try { return localStorage.getItem("hefisto_etq_tamanho") || "60x40"; } catch { return "60x40"; } });
  const [momento, setMomento] = useState(() => new Date());
  const [statusMdk, setStatusMdk] = useState("");
  const [detalhesMdk, setDetalhesMdk] = useState(null);
  const [mostrarDetalhesMdk, setMostrarDetalhesMdk] = useState(false);
  const [perfilFisico, setPerfilFisico] = useState(null);

  // Novos states UX
  const [recentesIds, setRecentesIds] = useState(() => { try { return JSON.parse(localStorage.getItem("hefisto_etq_recentes") || "[]"); } catch { return []; } });
  const [filtroMenu, setFiltroMenu] = useState("Todos");
  const [filaAberta, setFilaAberta] = useState(false);
  const [listasRecolhidas, setListasRecolhidas] = useState(true);

  const responsavel = funcionarios.find(pessoa => String(pessoa.id) === String(responsavelId));
  const totalEtiquetas = fila.reduce((total, produto) => total + Math.max(1, Math.floor(numero(produto.copias))), 0);

  const carregarBase = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    const [colaboradores, validades, perfisRes] = await Promise.all([fetchColaboradores(unidadeAtiva), fetchValidadesEtiqueta(unidadeAtiva), fetchPerfisEtiquetas(unidadeAtiva)]);
    setFuncionarios(equipeDaArea(colaboradores.data || [], setor));
    setCategorias(validades.data || []);
    const listaPerfis = perfisRes?.data || [];
    setPerfilFisico(listaPerfis.find(p => p.setor === setor) || null);
  }, [unidadeAtiva, setor]);
  useEffect(() => { carregarBase(); }, [carregarBase]);

  const carregarListas = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas" || !setor) return setListasSalvas([]);
    const remotas = await fetchListasEtiquetas(unidadeAtiva, setor, 30);
    const locais = lerListasLocais(unidadeAtiva, setor);
    const mapa = new Map([...(remotas.data || []), ...locais].map(lista => [String(lista.id), lista]));
    setListasSalvas([...mapa.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
  }, [setor, unidadeAtiva]);
  useEffect(() => { carregarListas(); }, [carregarListas]);

  useEffect(() => {
    if (!setor || !unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true; setCarregando(true);
    Promise.all([fetchEstoque(unidadeAtiva, setor), fetchProdutos(unidadeAtiva, setor), fetchFichas(unidadeAtiva, setor)]).then(([estoque, cardapio, fichas]) => {
      if (!ativo) return;
      const mapa = new Map();
      (estoque.data || []).forEach(produto => {
        if (!produto.nome) return;
        mapa.set(produto.nome.toLocaleLowerCase("pt-BR"), { id: \`estoque:\${produto.id || produto.insumo_id || produto.nome}\`, nome: produto.nome, unidade: String(produto.unidade_comercial || produto.unidade_medida || produto.unidade || "UN").toUpperCase(), custo: numero(produto.custo_unitario || produto.preco_unit), origem: "Ingrediente" });
      });
      (fichas.data || []).filter(f => f.eh_base).forEach(ficha => {
        const nome = ficha.nome_receita;
        if (!nome || mapa.has(nome.toLocaleLowerCase("pt-BR"))) return;
        mapa.set(nome.toLocaleLowerCase("pt-BR"), { id: \`base:\${ficha.id || nome}\`, nome, unidade: String(ficha.rendimento_unidade || "UN").toUpperCase(), custo: 0, origem: "Pré-preparo" });
      });
      (cardapio.data || []).forEach(produto => {
        const nome = produto.nome_produto;
        if (!nome || mapa.has(nome.toLocaleLowerCase("pt-BR"))) return;
        mapa.set(nome.toLocaleLowerCase("pt-BR"), { id: \`produto:\${produto.id || nome}\`, nome, unidade: "UN", custo: 0, origem: "Cardápio" });
      });
      setProdutos([...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [setor, unidadeAtiva]);

  // Aplicar Filtros Novos (Todos, Recentes, Favoritos, Ingredientes, Preparos)
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    let lista = produtos;
    if (filtroMenu === "Ingredientes") lista = lista.filter(p => p.origem === "Ingrediente");
    if (filtroMenu === "Preparos") lista = lista.filter(p => p.origem === "Pré-preparo" || p.origem === "Cardápio");
    if (filtroMenu === "Recentes") lista = lista.filter(p => recentesIds.includes(p.id));
    return lista.filter(produto => !termo || produto.nome.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, produtos, filtroMenu, recentesIds]);

  const produtosRecentes = useMemo(() => {
    return produtos.filter(p => recentesIds.includes(p.id)).slice(0, 10);
  }, [produtos, recentesIds]);

  function registrarRecente(id) {
    setRecentesIds(atuais => {
      const nova = [id, ...atuais.filter(x => x !== id)].slice(0, 20);
      try { localStorage.setItem("hefisto_etq_recentes", JSON.stringify(nova)); } catch {}
      return nova;
    });
  }

  function abrirProduto(produto) {
    registrarRecente(produto.id);
    // Tenta encontrar validade padrão baseada no nome usando a lista de categorias. Match fuzzy simples.
    let validadePadrao = 3;
    const cat = categorias.find(c => produto.nome.toLocaleLowerCase("pt-BR").includes(c.nome.toLocaleLowerCase("pt-BR")));
    if (cat) validadePadrao = cat.dias;

    setItem({ ...produto, quantidade: "", informarQuantidade: false, copias: 1, dias: validadePadrao, conservacao: "Resfriado", codigo: gerarCodigo() });
    setCategoriaId("");
    setModeloEtiqueta("validade");
    setMomento(new Date());
    setStatusMdk("");
    setDetalhesMdk(null);
    setMostrarDetalhesMdk(false);
  }

  function alterar(campo, valor) { setItem(atual => ({ ...atual, [campo]: valor })); }

  function voltar() {
    if (item) return setItem(null);
    if (responsavelId) { setResponsavelId(""); setFila([]); return; }
    if (setor) { setSetor(""); setBusca(""); return; }
    router.back();
  }

  async function telaCheia() { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); } catch {} }

  async function imprimirAgora() {
    if (!item || salvando) return;
    if (numero(item.copias) < 1 || (modeloEtiqueta === "validade" && numero(item.dias) < 0)) return setAviso({ tipo: "erro", texto: "Revise a quantidade de cópias e a validade." });
    if (!responsavel) return setAviso({ tipo: "erro", texto: "Escolha quem está etiquetando." });
    const pronto = { ...item, modeloEtiqueta, tipoEtiqueta, codigo: item.codigo || gerarCodigo() };
    const direta = true;

    // FLUXO DE IMPRESSÃO (NÃO ALTERAR LÓGICA)
    if (WebUsbDisponivel()) {
      setSalvando(true); setStatusMdk("Conectando à MDK-022..."); setDetalhesMdk(null);
      try {
        if (modeloEtiqueta === "validade") {
          try {
            await criarEtiqueta({ codigo: pronto.codigo, produto: pronto.nome, conservacao: pronto.conservacao, quantidade: pronto.informarQuantidade ? numero(pronto.quantidade) : 0, unidade: pronto.unidade, validade_dias: numero(pronto.dias), manipulacao_em: momento.toISOString(), validade_em: validadeDe(momento, pronto.dias).toISOString(), lote: setor === "bar" ? "BAR" : "COZINHA", responsavel: responsavel.nome, custo_unit: pronto.custo || 0, status: "ativa", copias: Math.max(1, Math.floor(numero(pronto.copias))), tipo_etiqueta: pronto.tipoEtiqueta || "aberto" }, unidadeAtiva, { departamento: setor, usuario: responsavel });
          } catch (eSupabase) {}
        }
        const res = await imprimirEtiquetaMdk022Usb({ dados: { ...pronto, produto: pronto.nome, unidadeNome: unidadeInfo?.nome_fantasia || unidadeInfo?.nome, momento, validade: validadeDe(momento, pronto.dias), responsavel: responsavel.nome, lote: setor === "bar" ? "BAR" : "COZINHA" }, tamanho, copias: Math.max(1, Math.floor(numero(pronto.copias))), perfilFisico, onStatusChange: (s) => setStatusMdk(s) });
        setStatusMdk("Etiqueta impressa."); setAviso({ tipo: "ok", texto: \`✓ \${pronto.nome} impresso com sucesso.\` });
        setItem(null); // Fecha o modal e volta p lista rapidamente
      } catch (errMdk) {
        setStatusMdk("Falha na MDK-022."); setAviso({ tipo: "erro", texto: \`Falha: \${errMdk?.message || String(errMdk)}\` });
      } finally { setSalvando(false); }
      return;
    }
    await imprimirFila("", [pronto]);
    setItem(null);
    setAviso({ tipo: "ok", texto: \`✓ \${pronto.nome} preparado para impressão.\` });
  }

  function adicionarFila() {
    if (!item || numero(item.copias) < 1 || (modeloEtiqueta === "validade" && numero(item.dias) < 0)) return setAviso({ tipo: "erro", texto: "Revise os dados." });
    setFila(atual => [...atual, { ...item, modeloEtiqueta, tipoEtiqueta, codigo: item.codigo || gerarCodigo() }]);
    setItem(null);
    setCriandoLivre(false);
    setNomeLivre("");
    setAviso({ tipo: "ok", texto: \`\${item.nome} adicionado à fila (\${fila.length + 1})\` });
  }

  function abrirNomeLivre() {
    const nome = nomeLivre.trim();
    if (!nome) return setAviso({ tipo: "erro", texto: "Digite o nome da etiqueta avulsa." });
    abrirProduto({ id: \`livre:\${Date.now()}\`, nome, unidade: "UN", custo: 0, origem: "Nome livre" });
  }

  function salvarFilaComoLista() {
    if (!fila.length || salvandoLista) return;
    setNomeNovaLista(\`Lista \${new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}\`);
    setModalSalvarLista(true);
  }

  async function confirmarSalvarLista() {
    if (!fila.length || salvandoLista) return;
    const nome = nomeNovaLista; setModalSalvarLista(false); setSalvandoLista(true);
    const itens = fila.map(({ codigo: _c, ...produto }) => produto);
    const dados = { nome: nome.trim() || "Lista Salva", setor, responsavelId: responsavel?.id, responsavelNome: responsavel?.nome, itens, totalEtiquetas, criadoPor: sessao?.nome || responsavel?.nome || null };
    const resposta = await salvarListaEtiquetas(dados, unidadeAtiva);
    if (resposta.error) {
      const locais = lerListasLocais(unidadeAtiva, setor);
      gravarListasLocais(unidadeAtiva, setor, [{ id: \`local:\${Date.now()}\`, unidade_id: unidadeAtiva, ...dados, responsavel_nome: dados.responsavelNome, total_etiquetas: totalEtiquetas, created_at: new Date().toISOString() }, ...locais]);
      setAviso({ tipo: "ok", texto: "Lista salva offline." });
    } else { setAviso({ tipo: "ok", texto: \`Lista \${dados.nome} salva.\` }); }
    setSalvandoLista(false); await carregarListas();
  }

  function carregarListaSalva(lista) {
    const itens = Array.isArray(lista.itens) ? lista.itens : [];
    if (!itens.length) return setAviso({ tipo: "erro", texto: "Lista vazia." });
    setFila(itens.map((i, idx) => ({ ...i, id: i.id || \`lista:\${lista.id}:\${idx}\`, codigo: gerarCodigo() })));
    setMomento(new Date()); setAviso({ tipo: "ok", texto: \`Lista \${lista.nome} carregada.\` });
    setFilaAberta(true); // Abre painel da fila
  }

  async function removerListaSalva(lista) {
    if (String(listaParaExcluir) !== String(lista.id)) return setListaParaExcluir(lista.id);
    setListaParaExcluir(null);
    if (String(lista.id).startsWith("local:")) {
      gravarListasLocais(unidadeAtiva, setor, lerListasLocais(unidadeAtiva, setor).filter(i => String(i.id) !== String(lista.id)));
    } else { await excluirListaEtiquetas(lista.id); }
    await carregarListas();
  }

  async function conectarTomatoBluetooth() {
    if (conectandoBluetooth) return;
    setConectandoBluetooth(true);
    try { const conexao = await conectarImpressoraBluetooth(); setBluetoothNome(conexao.nome); setAviso({ tipo: "ok", texto: \`\${conexao.nome} conectada.\` }); } 
    catch (erro) { setBluetoothNome(""); setAviso({ tipo: "erro", texto: erro?.message || "Falha Bluetooth." }); } 
    finally { setConectandoBluetooth(false); }
  }

  function processarComandoVozIA(t) {} function processarComandoVoz(t) {} function iniciarEscutaVoz() {} function fecharVoz() {}

  async function imprimirFila(comandoVoz = "", listaDireta = null) {
    const direta = Array.isArray(listaDireta) && listaDireta.length > 0;
    const lista = direta ? listaDireta : fila;
    const total = lista.reduce((soma, p) => soma + Math.max(1, Math.floor(numero(p.copias))), 0);
    if (!responsavel) return setAviso({ tipo: "erro", texto: "Escolha quem está etiquetando." });
    if (!lista.length) return setAviso({ tipo: "erro", texto: "Fila vazia." });

    if (WebUsbDisponivel()) {
      setSalvando(true); setStatusMdk("Enviando fila..."); setDetalhesMdk(null);
      try {
        const resLote = await imprimirFilaMdk022Usb({ fila: lista, tamanho, responsavel, unidadeInfo, setor, momento, perfilFisico, onStatusChange: (s) => setStatusMdk(s) });
        if (resLote.ok) {
          setAviso({ tipo: "ok", texto: \`✓ \${total} etiqueta(s) impressas!\` });
          if (!direta) { setFila([]); setFilaAberta(false); }
        }
      } catch (err) { setAviso({ tipo: "erro", texto: \`Falha: \${err?.message}\` }); } 
      finally { setSalvando(false); }
      return;
    }
    
    // HTML / Bluetooth fallback
    setSalvando(true);
    if (direta) { setFilaImpressao(lista); await new Promise(r => setTimeout(r, 80)); }
    try {
      if (bluetoothNome) { for (const produto of lista) await imprimirEtiquetasBluetooth({ tamanho, copias: Math.max(1, Math.floor(numero(produto.copias))), larguraImpressora: "58mm", perfilFisico, dados: { ...produto } }); } 
      else { const f = document.getElementById("etiquetas-rapidas-print"); if (f) imprimirHtml(\`<!doctype html><html><head><style>@page{size:60mm 40mm;margin:0}*{box-sizing:border-box}body{margin:0}#etiquetas-rapidas-print{width:60mm}</style></head><body>\${f.outerHTML}</body></html>\`, { aoFalhar: () => setAviso({tipo:"erro", texto:"Falha"})}); }
    } catch (e) { setAviso({ tipo: "erro", texto: e?.message }); }
    setSalvando(false);
    if (!direta) { setFila([]); setFilaAberta(false); }
  }

  function limparFila() { setFila([]); setFilaAberta(false); setAviso({ tipo: "ok", texto: "Fila esvaziada." }); }

  if (!unidadeAtiva || unidadeAtiva === "todas") return <div className="etq-vazio"><Tag size={56} /><h1>Escolha uma loja</h1></div>;

  // TELA 1: ÁREA
  if (!setor) return (
    <div className="ux-app">
      <style>{ESTILOS}</style>
      <header className="ux-header-simples">
        <button onClick={voltar}><ArrowLeft size={20} /> Voltar</button>
        <button onClick={telaCheia}><Maximize2 size={19} /> Tela cheia</button>
      </header>
      <main className="ux-area-main">
        <Tag size={42} color="var(--cor-brand)" />
        <h1>Etiquetas</h1>
        <p>Escolha onde você está trabalhando</p>
        <div className="ux-area-grid">
          <button className="ux-btn-cozinha" onClick={() => setSetor("cozinha")}>
            <ChefHat size={32} /> <strong>Cozinha</strong>
            <span>Produtos e pré-preparos</span>
          </button>
          <button className="ux-btn-bar" onClick={() => setSetor("bar")}>
            <GlassWater size={32} /> <strong>Bar</strong>
            <span>Bebidas e pré-preparos</span>
          </button>
        </div>
      </main>
    </div>
  );

  // TELA 2: FUNCIONÁRIO
  if (!responsavel) return (
    <div className="ux-app">
      <style>{ESTILOS}</style>
      <header className="ux-header-simples">
        <button onClick={voltar}><ArrowLeft size={20} /> Voltar</button>
      </header>
      <main className="ux-pessoas-main">
        <h1>Quem está etiquetando?</h1>
        <p className="ux-subtitle">{setor === "bar" ? "Bar" : "Cozinha"}</p>
        
        <div className="ux-busca-pessoa">
           <Search size={20} />
           <input placeholder="Buscar funcionário..." />
        </div>

        {carregando ? <div className="etq-sem"><RefreshCw className="animate-spin"/> Carregando...</div> : 
        <div className="ux-pessoas-grid">
          {funcionarios.map(f => (
            <button key={f.id} onClick={() => setResponsavelId(String(f.id))}>
              <div className="ux-avatar"><UserRound size={22}/></div>
              <div className="ux-pessoa-info">
                <strong>{f.nome}</strong>
                <small>{f.cargo || "Funcionário"}</small>
              </div>
            </button>
          ))}
        </div>}
      </main>
    </div>
  );

  // TELA 3: PRODUTOS (MAIN)
  return (
    <div className="ux-app">
      <style>{ESTILOS}</style>
      <header className="ux-header-op">
        <div className="ux-header-left">
          <button onClick={voltar}><ArrowLeft size={20} /></button>
          <div className="ux-header-title">
            <strong>ETIQUETAS • {setor.toUpperCase()}</strong>
            <span>Responsável: <b>{responsavel.nome}</b> <span className="ux-trocar" onClick={() => setResponsavelId("")}>Trocar</span></span>
          </div>
        </div>
        <div className="ux-header-right">
          <button className="ux-btn-icon" onClick={conectarTomatoBluetooth}><Bluetooth size={19} /></button>
          <button className="ux-btn-icon" onClick={telaCheia}><Maximize2 size={19} /></button>
          <button className="ux-btn-fila" onClick={() => setFilaAberta(true)}>Fila: {totalEtiquetas}</button>
        </div>
      </header>

      <main className="ux-main-content">
        {/* BUSCA E NOME LIVRE */}
        <div className="ux-busca-bar">
          <div className="ux-busca-input">
            <Search size={20} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto ou ingrediente..." />
            {busca && <button onClick={() => setBusca("")}><X size={18}/></button>}
          </div>
          {!criandoLivre ? 
            <button className="ux-btn-livre" onClick={() => setCriandoLivre(true)}><Plus size={18}/> Nome livre</button> :
            <div className="ux-livre-form">
              <input autoFocus value={nomeLivre} onChange={e => setNomeLivre(e.target.value)} onKeyDown={e => e.key === "Enter" && abrirNomeLivre()} placeholder="Qual nome?" />
              <button onClick={abrirNomeLivre}>OK</button>
              <button onClick={() => setCriandoLivre(false)}><X size={18}/></button>
            </div>
          }
        </div>

        {/* FILTROS */}
        {!busca && (
          <div className="ux-filtros">
            {["Todos", "Recentes", "Favoritos", "Ingredientes", "Preparos"].map(f => (
              <button key={f} className={filtroMenu === f ? "ativo" : ""} onClick={() => setFiltroMenu(f)}>{f}</button>
            ))}
          </div>
        )}

        {/* RECENTES (Se filtro == Todos e sem busca) */}
        {!busca && filtroMenu === "Todos" && produtosRecentes.length > 0 && (
          <div className="ux-section">
            <h3>Usados recentemente</h3>
            <div className="ux-grid-produtos">
              {produtosRecentes.map(p => (
                <button key={"rec-"+p.id} className="ux-card-produto" onClick={() => abrirProduto(p)}>
                  <strong>{p.nome}</strong>
                  <span><Tag size={12}/> Etiquetar</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LISTA GERAL */}
        <div className="ux-section">
          <h3>{busca ? "Resultados da busca" : filtroMenu}</h3>
          <div className="ux-grid-produtos">
            {visiveis.map(p => (
              <button key={p.id} className="ux-card-produto" onClick={() => abrirProduto(p)}>
                <strong>{p.nome}</strong>
                {p.origem === "Pré-preparo" ? <span className="prep"><ChefHat size={12}/> Preparo</span> : <span><Tag size={12}/> {p.origem}</span>}
              </button>
            ))}
            {visiveis.length === 0 && <p className="ux-vazio">Nenhum produto encontrado.</p>}
          </div>
        </div>

        {/* LISTAS SALVAS (COMPACTAS) */}
        <div className="ux-listas-recolhivel">
          <button className="ux-listas-toggle" onClick={() => setListasRecolhidas(!listasRecolhidas)}>
            <List size={18} /> Listas salvas ({listasSalvas.length}) 
            {listasRecolhidas ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          </button>
          {!listasRecolhidas && (
            <div className="ux-listas-conteudo">
              {listasSalvas.length === 0 ? <p>Nenhuma lista salva.</p> : listasSalvas.map(l => (
                <div key={l.id} className="ux-lista-item">
                  <button className="abrir" onClick={() => carregarListaSalva(l)}>
                    <strong>{l.nome}</strong>
                    <span>{l.total_etiquetas} etiquetas</span>
                  </button>
                  <button className="excluir" onClick={() => removerListaSalva(l)}>{String(listaParaExcluir) === String(l.id) ? "Confirmar" : "..."}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL CONFIGURAÇÃO ETIQUETA */}
      {item && (
        <div className="ux-modal-overlay" onClick={() => setItem(null)}>
          <div className="ux-modal-largo" onClick={e => e.stopPropagation()}>
            <div className="ux-modal-header">
              <h2>{item.nome}</h2>
              <button onClick={() => setItem(null)}><X size={24} /></button>
            </div>
            
            <div className="ux-modal-body">
              <div className="ux-modal-config">
                
                <div className="ux-field">
                  <label>Quantidade</label>
                  <div className="ux-qty-control">
                    <button onClick={() => alterar("copias", Math.max(1, numero(item.copias) - 1))}><Minus size={20}/></button>
                    <input type="number" min="1" max="999" value={item.copias} 
                           onChange={e => alterar("copias", e.target.value === "" ? "" : Number(e.target.value))}
                           onBlur={e => alterar("copias", Math.max(1, Number(e.target.value) || 1))} />
                    <button onClick={() => alterar("copias", numero(item.copias) + 1)}><Plus size={20}/></button>
                  </div>
                </div>

                <div className="ux-field">
                  <label>Validade <span className="ux-val-fim">Vence em: {dataCurta(validadeDe(momento, item.dias))}</span></label>
                  <div className="ux-val-shortcuts">
                    {[1, 2, 3, 5, 7].map(d => (
                      <button key={d} className={item.dias === d ? "ativo" : ""} onClick={() => alterar("dias", d)}>+{d}d</button>
                    ))}
                    <button className={![1,2,3,5,7].includes(numero(item.dias)) ? "ativo" : ""} 
                            onClick={() => { const p = prompt("Quantos dias?", item.dias); if(p) alterar("dias", Number(p)); }}>Outro</button>
                  </div>
                </div>

                <div className="ux-field">
                  <label>Conservação</label>
                  <div className="ux-segmented">
                    {["Resfriado", "Congelado", "Ambiente"].map(c => (
                      <button key={c} className={item.conservacao === c ? "ativo" : ""} onClick={() => alterar("conservacao", c)}>{c}</button>
                    ))}
                  </div>
                </div>

                <div className="ux-field">
                  <label>Estado</label>
                  <div className="ux-segmented">
                    <button className={tipoEtiqueta === "aberto" ? "ativo" : ""} onClick={() => setTipoEtiqueta("aberto")}>Manipulado / aberto</button>
                    <button className={tipoEtiqueta === "fechado" ? "ativo" : ""} onClick={() => setTipoEtiqueta("fechado")}>Produto fechado</button>
                  </div>
                </div>

                <div className="ux-field">
                  <label>Peso / Quantidade</label>
                  <div className="ux-segmented">
                    <button className={!item.informarQuantidade ? "ativo" : ""} onClick={() => alterar("informarQuantidade", false)}>Não informar</button>
                    <button className={item.informarQuantidade ? "ativo" : ""} onClick={() => alterar("informarQuantidade", true)}>Informar</button>
                  </div>
                  {item.informarQuantidade && (
                    <div className="ux-peso-input" style={{ marginTop: 8 }}>
                      <input type="number" step="0.01" value={item.quantidade} onChange={e => alterar("quantidade", e.target.value)} placeholder="0.00" />
                      <select value={item.unidade} onChange={e => alterar("unidade", e.target.value)}>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  )}
                </div>

              </div>
              
              <div className="ux-modal-preview">
                <label>Pré-visualização (60×40)</label>
                <div className="ux-preview-box">
                  <div className="ux-preview-scale">
                    <EtiquetaPapel item={item} responsavel={responsavel} unidadeInfo={unidadeInfo} momento={momento} tamanho="60x40" tipoEtiqueta={tipoEtiqueta} />
                  </div>
                </div>
              </div>
            </div>

            <div className="ux-modal-footer">
              <button className="ux-btn-outline" onClick={adicionarFila}><List size={18}/> Adicionar à fila</button>
              <button className="ux-btn-primary" onClick={imprimirAgora} disabled={salvando}>{salvando ? <RefreshCw className="animate-spin" size={18}/> : <Printer size={18}/>} Imprimir agora</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR FILA */}
      {filaAberta && (
        <div className="ux-fila-overlay" onClick={() => setFilaAberta(false)}>
          <div className="ux-fila-panel" onClick={e => e.stopPropagation()}>
            <div className="ux-fila-header">
              <h3>Fila de Impressão ({totalEtiquetas})</h3>
              <button onClick={() => setFilaAberta(false)}><X size={20}/></button>
            </div>
            <div className="ux-fila-body">
              {fila.length === 0 ? <p className="ux-vazio">A fila está vazia.</p> : fila.map((f, idx) => (
                <div key={f.codigo} className="ux-fila-item">
                  <div className="info">
                    <strong>{f.nome}</strong>
                    <span>Vence em {f.dias}d</span>
                  </div>
                  <div className="actions">
                    <span className="qtd">{f.copias}x</span>
                    <button onClick={() => setFila(atual => atual.filter((_, i) => i !== idx))}><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="ux-fila-footer">
              <button className="ux-btn-limpar" onClick={limparFila}>Limpar</button>
              <button className="ux-btn-salvar" onClick={salvarFilaComoLista}><Save size={18}/></button>
              <button className="ux-btn-primary" onClick={() => imprimirFila()} disabled={fila.length===0 || salvando}>{salvando ? "Enviando..." : \`Imprimir \${totalEtiquetas}\`}</button>
            </div>
          </div>
        </div>
      )}

      <div id="etiquetas-rapidas-print" aria-hidden="true">{responsavel && (filaImpressao.length ? filaImpressao : fila).flatMap(produto => Array.from({ length: Math.max(1, Math.floor(numero(produto.copias))) }, (_, indice) => <EtiquetaPapel key={\`\${produto.codigo}-\${indice}\`} item={produto} responsavel={responsavel} unidadeInfo={unidadeInfo} momento={momento} tamanho="60x40" tipoEtiqueta={produto.tipoEtiqueta || "aberto"} />))}</div>
      {aviso && <Aviso aviso={aviso} fechar={() => setAviso(null)} />}
    </div>
  );
}

const ESTILOS = \`
  .ux-app { min-height: 100vh; background: #f1f5f9; color: #0f172a; font-family: system-ui, -apple-system, sans-serif; }
  .ux-app * { box-sizing: border-box; }
  button { cursor: pointer; border: none; background: none; font-family: inherit; }
  input, select { font-family: inherit; }
  
  /* HEADER SIMPLES */
  .ux-header-simples { height: 60px; padding: 0 16px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .ux-header-simples button { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #475569; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; }
  
  /* MAIN AREA (TELA 1) */
  .ux-area-main { max-width: 600px; margin: 40px auto; text-align: center; padding: 20px; }
  .ux-area-main h1 { font-size: 32px; font-weight: 800; margin: 16px 0 8px; }
  .ux-area-main p { color: #64748b; font-size: 16px; margin-bottom: 32px; }
  .ux-area-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .ux-area-grid button { padding: 32px 20px; border-radius: 20px; border: 2px solid #e2e8f0; background: #fff; display: flex; flexDirection: column; align-items: center; transition: 0.2s; }
  .ux-area-grid button:active { border-color: #059669; background: #ecfdf5; }
  .ux-area-grid strong { font-size: 20px; font-weight: 800; display: block; margin: 12px 0 4px; color: #0f172a; }
  .ux-area-grid span { font-size: 13px; color: #64748b; }
  
  /* PESSOAS (TELA 2) */
  .ux-pessoas-main { max-width: 800px; margin: 30px auto; padding: 20px; text-align: center; }
  .ux-pessoas-main h1 { font-size: 28px; font-weight: 800; margin: 0 0 4px; }
  .ux-subtitle { color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }
  .ux-busca-pessoa { position: relative; max-width: 400px; margin: 0 auto 24px; }
  .ux-busca-pessoa svg { position: absolute; left: 16px; top: 14px; color: #94a3b8; }
  .ux-busca-pessoa input { width: 100%; height: 48px; border-radius: 12px; border: 2px solid #e2e8f0; padding: 0 16px 0 44px; font-size: 16px; outline: none; }
  .ux-busca-pessoa input:focus { border-color: #059669; }
  .ux-pessoas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .ux-pessoas-grid button { display: flex; align-items: center; gap: 12px; background: #fff; border: 2px solid #e2e8f0; padding: 12px; border-radius: 16px; text-align: left; }
  .ux-pessoas-grid button:active { border-color: #059669; }
  .ux-avatar { width: 44px; height: 44px; border-radius: 12px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; }
  .ux-pessoa-info strong { display: block; font-size: 15px; font-weight: 700; color: #1e293b; }
  .ux-pessoa-info small { display: block; font-size: 13px; color: #64748b; margin-top: 2px; }

  /* HEADER OP (TELA 3) */
  .ux-header-op { position: sticky; top: 0; z-index: 40; height: 64px; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
  .ux-header-left { display: flex; align-items: center; gap: 16px; }
  .ux-header-left > button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #475569; }
  .ux-header-title strong { display: block; font-size: 16px; font-weight: 800; color: #0f172a; }
  .ux-header-title span { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
  .ux-trocar { color: #059669; font-weight: 700; text-decoration: underline; cursor: pointer; margin-left: 4px; }
  .ux-header-right { display: flex; align-items: center; gap: 8px; }
  .ux-btn-icon { width: 40px; height: 40px; border-radius: 10px; background: #f8fafc; color: #475569; display: flex; align-items: center; justify-content: center; }
  .ux-btn-fila { height: 40px; padding: 0 16px; border-radius: 10px; background: #0f172a; color: #fff; font-weight: 700; font-size: 14px; }

  /* PRODUTOS */
  .ux-main-content { max-width: 1200px; margin: 0 auto; padding: 20px 16px 60px; }
  .ux-busca-bar { display: flex; gap: 12px; margin-bottom: 20px; }
  .ux-busca-input { position: relative; flex: 1; }
  .ux-busca-input svg { position: absolute; left: 14px; top: 14px; color: #94a3b8; }
  .ux-busca-input input { width: 100%; height: 48px; border-radius: 12px; border: 2px solid #e2e8f0; padding: 0 44px; font-size: 16px; outline: none; }
  .ux-busca-input input:focus { border-color: #059669; }
  .ux-busca-input button { position: absolute; right: 8px; top: 8px; width: 32px; height: 32px; border-radius: 8px; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; }
  .ux-btn-livre { height: 48px; padding: 0 16px; border-radius: 12px; background: #ecfdf5; color: #059669; border: 2px solid #a7f3d0; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .ux-livre-form { display: flex; gap: 8px; }
  .ux-livre-form input { height: 48px; border-radius: 12px; border: 2px solid #059669; padding: 0 12px; width: 180px; outline: none; }
  .ux-livre-form button { height: 48px; padding: 0 16px; border-radius: 12px; background: #059669; color: #fff; font-weight: 700; }
  
  .ux-filtros { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 16px; scrollbar-width: none; }
  .ux-filtros::-webkit-scrollbar { display: none; }
  .ux-filtros button { height: 36px; padding: 0 16px; border-radius: 18px; border: 1px solid #e2e8f0; background: #fff; color: #475569; font-size: 14px; font-weight: 600; white-space: nowrap; }
  .ux-filtros button.ativo { background: #0f172a; color: #fff; border-color: #0f172a; }

  .ux-section { margin-bottom: 32px; }
  .ux-section h3 { font-size: 14px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .ux-grid-produtos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .ux-card-produto { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; text-align: left; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between; min-height: 84px; }
  .ux-card-produto:active { border-color: #059669; }
  .ux-card-produto strong { display: block; font-size: 15px; font-weight: 700; color: #1e293b; line-height: 1.3; margin-bottom: 8px; }
  .ux-card-produto span { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; }
  .ux-card-produto span.prep { color: #d97706; background: #fef3c7; }
  .ux-vazio { color: #94a3b8; font-size: 15px; font-weight: 600; }

  .ux-listas-recolhivel { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-top: 10px; }
  .ux-listas-toggle { width: 100%; height: 54px; padding: 0 16px; display: flex; align-items: center; gap: 10px; font-weight: 700; color: #334155; font-size: 15px; }
  .ux-listas-toggle svg:last-child { margin-left: auto; color: #94a3b8; }
  .ux-listas-conteudo { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
  .ux-lista-item { display: flex; gap: 8px; }
  .ux-lista-item .abrir { flex: 1; text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
  .ux-lista-item .abrir strong { font-size: 14px; font-weight: 700; color: #1e293b; }
  .ux-lista-item .abrir span { font-size: 12px; color: #64748b; font-weight: 600; }
  .ux-lista-item .excluir { width: 44px; background: #fff1f2; color: #e11d48; border-radius: 10px; font-weight: 800; font-size: 12px; }

  /* MODAL CONFIGURAÇÃO */
  .ux-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(15,23,42,0.7); display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px); }
  .ux-modal-largo { width: 100%; max-width: 900px; background: #fff; border-radius: 24px; display: flex; flex-direction: column; max-height: calc(100vh - 32px); box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
  .ux-modal-header { height: 64px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background: #f8fafc; }
  .ux-modal-header h2 { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; }
  .ux-modal-header button { width: 36px; height: 36px; border-radius: 10px; background: #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; }
  
  .ux-modal-body { display: flex; flex: 1; overflow-y: auto; }
  .ux-modal-config { flex: 1; padding: 24px; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 20px; }
  .ux-modal-preview { width: 380px; padding: 24px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; }
  
  @media(max-width: 768px) {
    .ux-modal-body { flex-direction: column; }
    .ux-modal-preview { width: 100%; border-top: 1px solid #e2e8f0; padding: 16px; }
  }

  .ux-field > label { display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .ux-val-fim { color: #059669; text-transform: none; font-weight: 700; letter-spacing: 0; }
  
  .ux-qty-control { display: inline-flex; align-items: center; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; height: 48px; background: #fff; }
  .ux-qty-control button { width: 48px; height: 100%; background: #f8fafc; color: #0f172a; font-weight: 800; }
  .ux-qty-control input { width: 60px; height: 100%; text-align: center; border: none; outline: none; font-size: 20px; font-weight: 800; }

  .ux-val-shortcuts { display: flex; flex-wrap: wrap; gap: 8px; }
  .ux-val-shortcuts button { height: 44px; padding: 0 16px; border-radius: 10px; border: 2px solid #e2e8f0; background: #fff; font-weight: 700; font-size: 15px; color: #475569; flex: 1; min-width: 60px; }
  .ux-val-shortcuts button.ativo { border-color: #059669; background: #ecfdf5; color: #059669; }

  .ux-segmented { display: flex; background: #f1f5f9; border-radius: 12px; padding: 4px; gap: 4px; }
  .ux-segmented button { flex: 1; height: 40px; border-radius: 8px; font-weight: 700; font-size: 14px; color: #64748b; }
  .ux-segmented button.ativo { background: #fff; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

  .ux-peso-input { display: flex; gap: 8px; height: 48px; }
  .ux-peso-input input, .ux-peso-input select { height: 100%; border: 2px solid #e2e8f0; border-radius: 12px; padding: 0 12px; font-weight: 700; outline: none; }
  .ux-peso-input input { flex: 1; }
  .ux-peso-input select { width: 100px; background: #fff; }

  .ux-preview-box { width: 100%; aspect-ratio: 3/2; background: #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; margin-top: 10px; overflow: hidden; position: relative; }
  .ux-preview-scale { transform: scale(0.9); transform-origin: center; display: flex; align-items: center; justify-content: center; }

  .ux-modal-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; background: #fff; }
  .ux-btn-outline { flex: 1; height: 54px; border-radius: 14px; border: 2px solid #e2e8f0; font-weight: 800; font-size: 16px; color: #475569; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .ux-btn-primary { flex: 1; height: 54px; border-radius: 14px; background: #059669; color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; }

  /* SIDEBAR FILA */
  .ux-fila-overlay { position: fixed; inset: 0; z-index: 120; background: rgba(0,0,0,0.4); display: flex; justify-content: flex-end; }
  .ux-fila-panel { width: 100%; max-width: 400px; background: #fff; height: 100%; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.1); animation: slideIn 0.2s; }
  @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .ux-fila-header { height: 64px; padding: 0 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
  .ux-fila-header h3 { margin: 0; font-size: 18px; font-weight: 800; }
  .ux-fila-header button { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #e2e8f0; border-radius: 10px; }
  .ux-fila-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .ux-fila-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
  .ux-fila-item .info strong { display: block; font-size: 14px; font-weight: 800; color: #0f172a; }
  .ux-fila-item .info span { font-size: 12px; color: #64748b; font-weight: 600; }
  .ux-fila-item .actions { display: flex; align-items: center; gap: 12px; }
  .ux-fila-item .qtd { font-weight: 900; color: #059669; font-size: 15px; }
  .ux-fila-item button { color: #ef4444; }
  .ux-fila-footer { padding: 16px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; background: #fff; }
  .ux-btn-limpar { height: 50px; padding: 0 16px; border-radius: 12px; background: #fef2f2; color: #ef4444; font-weight: 700; }
  .ux-btn-salvar { width: 50px; height: 50px; border-radius: 12px; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; }

  .etq-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 200; background: #0f172a; color: #fff; padding: 14px 20px; border-radius: 14px; font-weight: 700; display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
  .etq-toast.ok { background: #059669; }
  .etq-toast.erro { background: #e11d48; }
\`;
`;

fs.writeFileSync('tail.js', tail, 'utf-8');
const finalContent = head + tail;
fs.writeFileSync('app/components/EtiquetasRapidas.js', finalContent, 'utf-8');
console.log("Rewrite completed.");
