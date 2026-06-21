import { supabase, isSupabaseReady } from "./supabase";
import { carimbarUnidade } from "./unidades";

export async function fetchConfigImpressao(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: null };
  const { data, error } = await supabase
    .from("config_impressoes")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (error) {
    console.error("[impressoes] fetchConfigImpressao:", error.message);
    return { data: null, error: error.message };
  }

  // Se não existir, retorna um padrão
  if (!data) {
    return {
      data: {
        tamanho_papel: '80mm',
        cabecalho: 'Meu Restaurante',
        rodape: 'Obrigado pela preferência!',
        imprimir_cozinha: true,
        imprimir_conta: true,
        mostrar_precos_cozinha: false
      },
      error: null
    };
  }

  return { data, error: null };
}

export async function salvarConfigImpressao(config, unidadeId) {
  if (!isSupabaseReady()) return { error: "Supabase não configurado" };

  const { error } = await supabase
    .from("config_impressoes")
    .upsert(carimbarUnidade({
      tamanho_papel: config.tamanho_papel,
      cabecalho: config.cabecalho,
      rodape: config.rodape,
      imprimir_cozinha: config.imprimir_cozinha,
      imprimir_conta: config.imprimir_conta,
      mostrar_precos_cozinha: config.mostrar_precos_cozinha,
      updated_at: new Date().toISOString()
    }, unidadeId));

  if (error) {
    console.error("[impressoes] salvarConfigImpressao:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

// ── Motor de Impressão (Navegador) ──────────────────────────────────────────
export function imprimirHtml(htmlString, tamanho = '80mm') {
  // tamanho pode ser 80mm ou 58mm
  const widthMap = {
    '80mm': '300px', // aprox
    '58mm': '210px'  // aprox
  };
  const printWidth = widthMap[tamanho] || '300px';

  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <style>
          @page { margin: 0; size: auto; }
          body { 
            font-family: "Courier New", Courier, monospace; 
            margin: 0; 
            padding: 10px; 
            width: ${printWidth};
            color: #000;
            font-size: 13px;
            text-transform: uppercase;
          }
          h1, h2, h3, h4 { margin: 4px 0; text-align: center; font-weight: bold; }
          p { margin: 2px 0; }
          .center { text-align: center; }
          .flex-between { display: flex; justify-content: space-between; }
          .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
          .bold { font-weight: bold; }
          .item-row { display: flex; align-items: flex-start; margin-bottom: 2px; }
          .item-qtd { width: 30px; flex-shrink: 0; }
          .item-desc { flex: 1; }
          .item-val { width: 60px; text-align: right; flex-shrink: 0; }
          .sub-item { padding-left: 30px; font-size: 11px; }
        </style>
      </head>
      <body>
        ${htmlString}
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 200);
}
