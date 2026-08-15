"use client";

// RECONHECIMENTO FACIAL — tudo acontece no próprio aparelho.
// O modelo roda no tablet/celular e produz um "descritor": 128 números que
// representam o rosto. Só esses números vão para o banco — a foto do cadastro
// não é enviada nem guardada, e não é possível reconstruir a face a partir do
// descritor.
//
// Regra de ouro da identificação: na dúvida, NÃO identifica. É melhor pedir o
// PIN do que registrar o ponto na pessoa errada.

const CDN = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13";
const MODELOS = `${CDN}/model`;

// Distância euclidiana máxima para aceitar um rosto como sendo o cadastrado.
// 0.6 é o padrão da literatura; usamos mais rígido para evitar troca de pessoa.
export const LIMIAR_ACEITE = 0.48;
// Se o segundo colocado estiver perto demais do primeiro, é ambíguo: recusa.
export const MARGEM_MINIMA = 0.06;

let faceapi = null;
let carregando = null;

// Carrega a biblioteca e os modelos uma única vez.
export async function prepararFacial(aoProgresso) {
  if (faceapi) return faceapi;
  if (carregando) return carregando;
  carregando = (async () => {
    aoProgresso?.("Baixando o reconhecimento facial...");
    if (!window.faceapi) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `${CDN}/dist/face-api.js`;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Não consegui baixar o reconhecimento facial. Verifique a internet."));
        document.head.appendChild(s);
      });
    }
    const api = window.faceapi;
    aoProgresso?.("Preparando os modelos...");
    await api.nets.ssdMobilenetv1.loadFromUri(MODELOS);
    await api.nets.faceLandmark68Net.loadFromUri(MODELOS);
    await api.nets.faceRecognitionNet.loadFromUri(MODELOS);
    faceapi = api;
    aoProgresso?.("");
    return api;
  })();
  return carregando;
}

// Extrai o descritor de UM rosto de um <video> ou <canvas>/<img>.
// Devolve { descritor, erro } — erro em português, pronto para a tela.
export async function lerRosto(fonte) {
  const api = await prepararFacial();
  const deteccoes = await api
    .detectAllFaces(fonte, new api.SsdMobilenetv1Options({ minConfidence: 0.55 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (!deteccoes.length) return { erro: "Nenhum rosto na câmera. Fique de frente e com o rosto iluminado." };
  if (deteccoes.length > 1) return { erro: "Mais de um rosto na câmera. Fique sozinho na frente do tablet." };

  const d = deteccoes[0];
  const caixa = d.detection?.box;
  // Rosto muito pequeno = longe demais; o descritor sai instável.
  if (caixa && caixa.width < 90) return { erro: "Aproxime o rosto do tablet." };

  return { descritor: Array.from(d.descriptor) };
}

function distancia(a, b) {
  let soma = 0;
  for (let i = 0; i < a.length; i += 1) { const d = a[i] - b[i]; soma += d * d; }
  return Math.sqrt(soma);
}

// Compara um rosto lido com o cadastro de todo mundo.
// pessoas: [{ id, nome, descritores: [[128 números], ...] }]
// Retorna { pessoa, distancia } ou { erro } quando não dá para ter certeza.
export function identificar(descritor, pessoas) {
  const notas = [];
  for (const pessoa of pessoas) {
    const lista = Array.isArray(pessoa.descritores) ? pessoa.descritores : [];
    if (!lista.length) continue;
    // Usa a MELHOR das capturas cadastradas daquela pessoa.
    const melhor = Math.min(...lista.map(d => distancia(descritor, d)));
    notas.push({ pessoa, distancia: melhor });
  }
  if (!notas.length) return { erro: "Nenhum funcionário com rosto cadastrado nesta unidade." };

  notas.sort((a, b) => a.distancia - b.distancia);
  const primeiro = notas[0];
  const segundo = notas[1];

  if (primeiro.distancia > LIMIAR_ACEITE) {
    return { erro: "Não reconheci o rosto. Tente de novo com mais luz ou use o PIN." };
  }
  // Dois cadastros parecidos demais (irmãos, gêmeos, cadastro ruim): não arrisca.
  if (segundo && (segundo.distancia - primeiro.distancia) < MARGEM_MINIMA) {
    return { erro: "Não consegui ter certeza de quem é. Use o PIN para registrar." };
  }
  return { pessoa: primeiro.pessoa, distancia: primeiro.distancia };
}

// Confere se as capturas do cadastro são da MESMA pessoa e consistentes.
export function validarCapturas(descritores) {
  if (descritores.length < 3) return "Faça pelo menos 3 capturas.";
  for (let i = 0; i < descritores.length; i += 1) {
    for (let j = i + 1; j < descritores.length; j += 1) {
      if (distancia(descritores[i], descritores[j]) > 0.55) {
        return "As capturas parecem de pessoas diferentes. Refaça o cadastro.";
      }
    }
  }
  return "";
}

// Foto pequena da batida, para conferência posterior (auditoria).
export function fotoDoQuadro(video, largura = 240) {
  try {
    const escala = largura / (video.videoWidth || largura);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = Math.round((video.videoHeight || largura) * escala);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6).split(",")[1] || "";
  } catch { return ""; }
}
