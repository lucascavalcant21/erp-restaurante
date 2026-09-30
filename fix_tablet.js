const fs = require('fs');
let content = fs.readFileSync('app/components/TabletSetor.js', 'utf-8');

const start = content.indexOf('if (!departamento) {');
const end = content.indexOf('        {toast && <Toast', start);

const newBlock = `if (!departamento) {
    return (
      <div className="fixed inset-0 z-[80] overflow-auto bg-[#F7F8F7] text-zinc-950 p-4 sm:p-10 flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <button 
            className="h-11 border border-zinc-200 rounded-xl bg-white text-zinc-700 px-4 flex items-center gap-2 font-bold shadow-sm hover:bg-zinc-50 transition-colors"
            onClick={() => router.push(voltarHref)}
          >
            <ArrowLeft size={19} /> Voltar
          </button>
          <button 
            className="h-11 border border-zinc-200 rounded-xl bg-white text-zinc-700 px-4 flex items-center gap-2 font-bold shadow-sm hover:bg-zinc-50 transition-colors"
            onClick={pedirTelaCheia}
          >
            <Maximize2 size={18} /> Tela cheia
          </button>
        </div>
        
        <main className="w-full max-w-4xl mx-auto text-center flex-1 flex flex-col justify-center py-10">
          <div className="w-20 h-20 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-zinc-400">
            <ShoppingBasket size={40} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-900 mb-3">Estoque</h1>
          <p className="text-zinc-500 font-medium text-lg mb-10">Primeiro, escolha onde o produto será depositado ou retirado.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <button 
              className="flex flex-col items-center justify-center gap-3 p-8 sm:p-12 bg-white border border-zinc-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all active:scale-[0.98] group"
              onClick={() => selecionarSetor("cozinha")}
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <ChefHat size={32} />
              </div>
              <span className="text-2xl font-black text-zinc-900">Cozinha</span>
              <span className="text-sm font-bold text-zinc-500">Alimentos e insumos da cozinha</span>
            </button>
            
            <button 
              className="flex flex-col items-center justify-center gap-3 p-8 sm:p-12 bg-white border border-zinc-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all active:scale-[0.98] group"
              onClick={() => selecionarSetor("bar")}
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <GlassWater size={32} />
              </div>
              <span className="text-2xl font-black text-zinc-900">Bar</span>
              <span className="text-sm font-bold text-zinc-500">Bebidas e insumos do bar</span>
            </button>
            
            <button 
              className="flex flex-col items-center justify-center gap-3 p-8 sm:p-12 bg-white border border-zinc-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-sky-500/30 transition-all active:scale-[0.98] group"
              onClick={() => selecionarSetor("limpeza")}
            >
              <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Sparkles size={32} />
              </div>
              <span className="text-2xl font-black text-zinc-900">Limpeza</span>
              <span className="text-sm font-bold text-zinc-500">Produtos de limpeza da casa</span>
            </button>
            
            <button 
              className="flex flex-col items-center justify-center gap-3 p-8 sm:p-12 bg-white border border-zinc-200 rounded-[2rem] shadow-sm hover:shadow-md hover:border-slate-500/30 transition-all active:scale-[0.98] group"
              onClick={() => selecionarSetor("embalagens")}
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Package size={32} />
              </div>
              <span className="text-2xl font-black text-zinc-900">Embalagens</span>
              <span className="text-sm font-bold text-zinc-500">Potes, sacos e descartáveis</span>
            </button>
          </div>
        </main>
`;

const updatedContent = content.substring(0, start) + newBlock + content.substring(end);
fs.writeFileSync('app/components/TabletSetor.js', updatedContent);
console.log("Replaced!");
