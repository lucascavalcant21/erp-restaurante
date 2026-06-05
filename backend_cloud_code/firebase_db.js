/**
 * firebase_db.js — Camada de persistência Firestore
 * Cerebro ERP | Seldeestrela, Tico Tico Saladas, Burguer
 *
 * Inicialização via variáveis de ambiente (Vercel):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (com \n escapados)
 *
 * Coleções Firestore:
 *   estoque/{loja_id}/itens/{item_id}
 *   funcionarios/{funcionario_id}
 *   eventos/{evento_id}
 *   documentos/{doc_id}
 *   clientes/{cliente_id}
 *   campanhas/{campanha_id}
 *   feedbacks/{feedback_id}
 *   pratos/{prato_id}
 *   lancamentos_financeiros/{id}
 *   escalas/{id}
 *   config/{loja_id}
 */

let admin;
try {
  admin = require('firebase-admin');
} catch(e) {
  console.warn('[Firebase] firebase-admin não disponível:', e.message);
  admin = null;
}

// ---------------------------------------------------------------------------
// Inicialização — singleton
// ---------------------------------------------------------------------------

let _db = null;

function getDb() {
  if (_db) return _db;
  if (!admin) return null;

  if (!admin.apps.length) {
    const projectId    = process.env.FIREBASE_PROJECT_ID;
    const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey   = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null;

    if (!projectId || !clientEmail || !privateKey) {
      console.error('[Firebase] Variáveis de ambiente não configuradas. Usando modo em memória.');
      return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    console.log(`[Firebase] Conectado ao projeto: ${projectId}`);
  }

  _db = admin.firestore();
  return _db;
}

// ---------------------------------------------------------------------------
// Helpers genéricos
// ---------------------------------------------------------------------------

/**
 * Salvar/atualizar documento
 * @param {string} colecao
 * @param {string} id
 * @param {object} dados
 */
async function salvar(colecao, id, dados) {
  const db = getDb();
  if (!db) return { ok: false, erro: 'Firebase não configurado' };

  const doc = { ...dados, _atualizado_em: admin && admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString() };
  await db.collection(colecao).doc(String(id)).set(doc, { merge: true });
  return { ok: true };
}

/**
 * Buscar documento por ID
 */
async function buscar(colecao, id) {
  const db = getDb();
  if (!db) return null;

  const snap = await db.collection(colecao).doc(String(id)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Listar todos os documentos de uma coleção
 * @param {string} colecao
 * @param {Array}  filtros  ex: [['loja_id', '==', 'seldeestrela']]
 */
async function listar(colecao, filtros = []) {
  const db = getDb();
  if (!db) return [];

  let query = db.collection(colecao);
  for (const [campo, op, valor] of filtros) {
    query = query.where(campo, op, valor);
  }

  const snap = await query.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Deletar documento
 */
async function deletar(colecao, id) {
  const db = getDb();
  if (!db) return { ok: false };

  await db.collection(colecao).doc(String(id)).delete();
  return { ok: true };
}

/**
 * Gerar ID único (timestamp + random)
 */
function novoId(prefixo = 'doc') {
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Verificar se Firebase está configurado
 */
function firebaseAtivo() {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

// ---------------------------------------------------------------------------
// Helpers específicos por domínio
// ---------------------------------------------------------------------------

// ESTOQUE
const estoque = {
  salvarItem:  (lojaId, itemId, dados) => salvar(`estoque_${lojaId}`, itemId, dados),
  buscarItem:  (lojaId, itemId)        => buscar(`estoque_${lojaId}`, itemId),
  listarItens: (lojaId)                => listar(`estoque_${lojaId}`),
  deletarItem: (lojaId, itemId)        => deletar(`estoque_${lojaId}`, itemId),
};

// FUNCIONÁRIOS
const funcionarios = {
  salvar:  (id, dados) => salvar('funcionarios', id, dados),
  buscar:  (id)        => buscar('funcionarios', id),
  listar:  (lojaId)    => listar('funcionarios', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('funcionarios', id),
};

// EVENTOS
const eventos = {
  salvar:  (id, dados) => salvar('eventos', id, dados),
  buscar:  (id)        => buscar('eventos', id),
  listar:  (lojaId)    => listar('eventos', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('eventos', id),
};

// DOCUMENTOS
const documentos = {
  salvar:  (id, dados) => salvar('documentos', id, dados),
  buscar:  (id)        => buscar('documentos', id),
  listar:  (lojaId)    => listar('documentos', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('documentos', id),
};

// CRM — Clientes
const clientes = {
  salvar:  (id, dados) => salvar('clientes', id, dados),
  buscar:  (id)        => buscar('clientes', id),
  listar:  (lojaId)    => listar('clientes', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('clientes', id),
};

// CRM — Campanhas
const campanhas = {
  salvar:  (id, dados) => salvar('campanhas', id, dados),
  buscar:  (id)        => buscar('campanhas', id),
  listar:  (lojaId)    => listar('campanhas', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('campanhas', id),
};

// CRM — Feedbacks / NPS
const feedbacks = {
  salvar:  (id, dados) => salvar('feedbacks', id, dados),
  listar:  (lojaId)    => listar('feedbacks', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('feedbacks', id),
};

// PRATOS (CMV + Menu Engineering)
const pratos = {
  salvar:  (id, dados) => salvar('pratos', id, dados),
  buscar:  (id)        => buscar('pratos', id),
  listar:  (lojaId)    => listar('pratos', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('pratos', id),
};

// FINANCEIRO — Lançamentos
const financeiro = {
  salvar:  (id, dados) => salvar('lancamentos_financeiros', id, dados),
  listar:  (lojaId)    => listar('lancamentos_financeiros', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('lancamentos_financeiros', id),
};

// ESCALA — Turnos e pontos
const escalas = {
  salvar:  (id, dados) => salvar('escalas', id, dados),
  listar:  (lojaId)    => listar('escalas', lojaId ? [['loja_id', '==', lojaId]] : []),
  deletar: (id)        => deletar('escalas', id),
};

// CONFIGURAÇÕES por loja
const config = {
  salvar: (lojaId, dados) => salvar('config', lojaId, dados),
  buscar: (lojaId)        => buscar('config', lojaId),
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getDb,
  firebaseAtivo,
  novoId,
  // Genéricos
  salvar,
  buscar,
  listar,
  deletar,
  // Por domínio
  estoque,
  funcionarios,
  eventos,
  documentos,
  clientes,
  campanhas,
  feedbacks,
  pratos,
  financeiro,
  escalas,
  config,
};
