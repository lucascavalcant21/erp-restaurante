export function mmToDots(mm, dpi = 203) {
  if (typeof mm !== "number" || isNaN(mm)) return 0;
  return Math.round(mm * (dpi / 25.4));
}

export function dotsToMm(dots, dpi = 203) {
  if (typeof dots !== "number" || isNaN(dots)) return 0;
  return dots / (dpi / 25.4);
}

export const PRESETS_ETIQUETAS = [
  { id: "preset-60x40", nome: "60 × 40 mm", widthMm: 60, heightMm: 40, gapMm: 2, custom: false },
  { id: "preset-80x40", nome: "80 × 40 mm", widthMm: 80, heightMm: 40, gapMm: 2, custom: false },
  { id: "preset-60x60", nome: "60 × 60 mm", widthMm: 60, heightMm: 60, gapMm: 2, custom: false },
];

export function getDefaultPerfilFisico(setor = "padrao") {
  return {
    id: `perfil-${Date.now()}`,
    nome: "Novo Perfil",
    setor: setor,
    printerType: "mdk022",
    widthMm: 60,
    heightMm: 40,
    gapMm: 2,
    marginTopMm: 1,
    marginRightMm: 1,
    marginBottomMm: 1,
    marginLeftMm: 2,
    offsetXmm: 0,
    offsetYmm: 0,
    rotation: 0, // graus: 0, 90, 180, 270
    dpi: 203,
    isDefault: true,
  };
}
