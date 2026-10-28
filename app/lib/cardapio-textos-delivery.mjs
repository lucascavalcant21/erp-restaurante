// Textos fixos das telas novas do delivery (protótipos Delivery*), nos 8
// idiomas do cardápio. O conteúdo do dono (pratos, promoções) é traduzido no
// editor de idiomas; isto é só a interface. A palavra DESCONTO é do
// cardapio-visual.mjs (PalavraDesconto), sempre em maiúsculas.

const T = {
  agora_na_casa: { pt: "Agora na casa", en: "Now at the house", es: "Ahora en la casa", it: "Ora in casa", fr: "En ce moment", zh: "店内推荐", ja: "ただいまのおすすめ", ko: "지금 추천" },
  ver_tudo: { pt: "Ver tudo", en: "See all", es: "Ver todo", it: "Vedi tutto", fr: "Tout voir", zh: "查看全部", ja: "すべて見る", ko: "전체 보기" },
  destaque: { pt: "Destaque", en: "Featured", es: "Destacado", it: "In evidenza", fr: "À la une", zh: "推荐", ja: "おすすめ", ko: "추천" },
  info: { pt: "Info", en: "Info", es: "Info", it: "Info", fr: "Infos", zh: "信息", ja: "情報", ko: "정보" },
  aberto: { pt: "Aberto", en: "Open", es: "Abierto", it: "Aperto", fr: "Ouvert", zh: "营业中", ja: "営業中", ko: "영업 중" },
  fechado: { pt: "Fechado agora", en: "Closed now", es: "Cerrado ahora", it: "Chiuso ora", fr: "Fermé", zh: "暂停营业", ja: "営業時間外", ko: "영업 종료" },
  taxa: { pt: "Taxa de entrega {valor}", en: "Delivery fee {valor}", es: "Envío {valor}", it: "Consegna {valor}", fr: "Livraison {valor}", zh: "配送费 {valor}", ja: "配送料 {valor}", ko: "배달비 {valor}" },
  entrega_gratis: { pt: "Entrega grátis", en: "Free delivery", es: "Envío gratis", it: "Consegna gratuita", fr: "Livraison offerte", zh: "免配送费", ja: "配送無料", ko: "무료 배달" },
  minimo: { pt: "Pedido mínimo {valor}", en: "Minimum order {valor}", es: "Pedido mínimo {valor}", it: "Ordine minimo {valor}", fr: "Commande minimum {valor}", zh: "起送 {valor}", ja: "最低注文 {valor}", ko: "최소 주문 {valor}" },
  tempo: { pt: "Entrega em {min}–{max} min", en: "Delivery in {min}–{max} min", es: "Entrega en {min}–{max} min", it: "Consegna in {min}–{max} min", fr: "Livraison en {min}–{max} min", zh: "{min}–{max} 分钟送达", ja: "{min}〜{max}分でお届け", ko: "{min}–{max}분 배달" },
  para_casa: { pt: "PARA QUEM É DA CASA", en: "FOR OUR REGULARS", es: "PARA LOS DE CASA", it: "PER I CLIENTI DI CASA", fr: "POUR LES HABITUÉS", zh: "会员专享", ja: "常連さま限定", ko: "단골 고객 전용" },
  cadastre_ganhe: { pt: "Cadastre-se e ganhe", en: "Sign up and get", es: "Regístrate y gana", it: "Iscriviti e ottieni", fr: "Inscrivez-vous et gagnez", zh: "注册即享", ja: "登録で", ko: "가입하고 받기" },
  todos_pedidos: { pt: "em todos os pedidos", en: "on every order", es: "en todos los pedidos", it: "su tutti gli ordini", fr: "sur toutes les commandes", zh: "所有订单", ja: "すべての注文で", ko: "모든 주문에" },
  primeiro_pedido: { pt: "no primeiro pedido", en: "on your first order", es: "en el primer pedido", it: "sul primo ordine", fr: "sur la première commande", zh: "首单", ja: "初回の注文で", ko: "첫 주문에" },
  ponto: { pt: "R$ 1 = 1 ponto", en: "R$ 1 = 1 point", es: "R$ 1 = 1 punto", it: "R$ 1 = 1 punto", fr: "1 R$ = 1 point", zh: "R$ 1 = 1 积分", ja: "R$ 1 = 1ポイント", ko: "R$ 1 = 1포인트" },
  quero: { pt: "Quero", en: "Join", es: "Quiero", it: "Voglio", fr: "Je veux", zh: "我要", ja: "登録", ko: "가입" },
  buscar: { pt: "Buscar prato ou bebida", en: "Search dishes or drinks", es: "Buscar plato o bebida", it: "Cerca piatto o bevanda", fr: "Chercher un plat ou une boisson", zh: "搜索菜品或饮品", ja: "料理・ドリンクを検索", ko: "메뉴 검색" },
  fechar: { pt: "Fechar", en: "Close", es: "Cerrar", it: "Chiudi", fr: "Fermer", zh: "关闭", ja: "閉じる", ko: "닫기" },
  me_ajuda: { pt: "Me ajuda a escolher", en: "Help me choose", es: "Ayúdame a elegir", it: "Aiutami a scegliere", fr: "Aidez-moi à choisir", zh: "帮我选", ja: "選ぶのを手伝って", ko: "추천받기" },
  ver_sacola: { pt: "Ver sacola", en: "View bag", es: "Ver bolsa", it: "Vedi carrello", fr: "Voir le panier", zh: "查看购物袋", ja: "カートを見る", ko: "장바구니 보기" },
  inicio: { pt: "Início", en: "Home", es: "Inicio", it: "Home", fr: "Accueil", zh: "首页", ja: "ホーム", ko: "홈" },
  pedidos: { pt: "Pedidos", en: "Orders", es: "Pedidos", it: "Ordini", fr: "Commandes", zh: "订单", ja: "注文", ko: "주문" },
  descontos: { pt: "Descontos", en: "Discounts", es: "Descuentos", it: "Sconti", fr: "Réductions", zh: "优惠", ja: "割引", ko: "할인" },
  nada: { pt: "Nada encontrado com esse nome.", en: "Nothing found with that name.", es: "No encontramos nada con ese nombre.", it: "Niente con questo nome.", fr: "Rien trouvé avec ce nom.", zh: "没有找到相关菜品。", ja: "見つかりませんでした。", ko: "검색 결과가 없습니다." },
  sem_pratos: { pt: "O cardápio está sendo montado. Volte daqui a pouco.", en: "The menu is being prepared. Please come back soon.", es: "Estamos armando el menú. Vuelve pronto.", it: "Il menù è in preparazione. Torna presto.", fr: "Le menu est en préparation. Revenez bientôt.", zh: "菜单准备中，请稍后再来。", ja: "メニューを準備中です。", ko: "메뉴를 준비 중입니다." },
  no_pedido: { pt: "{n} na sacola", en: "{n} in bag", es: "{n} en la bolsa", it: "{n} nel carrello", fr: "{n} au panier", zh: "已加入 {n}", ja: "カートに{n}", ko: "{n}개 담김" },
};

export function textoDelivery(idioma, chave, vars = {}) {
  const linha = T[chave];
  if (!linha) return chave;
  return String(linha[idioma] || linha.pt).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export const CHAVES_DELIVERY = Object.keys(T);
export const IDIOMAS_DELIVERY = (k) => Object.keys(T[k] || {});
