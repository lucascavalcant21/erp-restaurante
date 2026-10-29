import Icone from "./Icone";
import s from "./ui.module.css";

// Foto do prato. Sem foto: espaço cinza claro (9L), sem inventar imagem.
// `video` põe a etiqueta "vídeo" no canto (o vídeo que toca no quadro vem com
// a tela do cardápio). `escura` = fundo cinza escuro para foto grande.
export default function FotoPrato({
  src, alt = "", largura, altura, raio = "var(--cd-raio-foto)", escura = false, video = false, etiquetaPequena = false, zoomLento = false,
  className = "", style, children,
}) {
  return (
    <div
      className={`${s.foto} ${escura ? s.fotoEscura : ""} ${className}`}
      style={{ width: largura, height: altura, borderRadius: raio, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img className={`${s.fotoImagem} ${zoomLento ? s.zoomLento : ""}`} src={src} alt={alt} loading="lazy" /> : null}
      {video ? (
        <span className={`${s.etiquetaVideo} ${etiquetaPequena ? s.etiquetaVideoP : ""}`}>
          <Icone nome="play" tamanho={etiquetaPequena ? 9 : 10} />
          vídeo
        </span>
      ) : null}
      {children}
    </div>
  );
}
