"use client";

/**
 * TabletSetor — Modo Tablet reutilizável para Bar e Cozinha.
 * Filtra os ingredientes pelo campo `setor` ("Bar" | "Cozinha").
 * Usado em:
 *   /dashboard/bar/tablet      → setor="Bar",    cor=#3B82F6, emoji=🍹
 *   /dashboard/cozinha/tablet  → setor="Cozinha", cor=#10B981, emoji=👨‍🍳
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, PackagePlus, PackageMinus, Clock, ChevronLeft,
  CheckCircle, AlertTriangle, XCircle, Lock, X, RotateCcw,
  ArrowLeft, Layers, User, BookOpen, Plus, Minus,
} from "lucide-react";
import { fetchEstoque, movimentarTablet, fetchHistoricoTablet } from "../lib/estoque";
import { fetchFuncionarios } from "../lib/rh";
import { useERP } from "../context/ERPContext";
import { supabase, isSupabaseReady } from "../lib/supabase";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtHora = (iso) => { if (!iso) return "--"; const d = new Date(iso); return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const fmtData = (iso) => { if (!iso) return "--"; const d = new Date(iso); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); };

function statusItem(item) {
  if (!item.quantidade || item.quantidade <= 0) return "zero";
  if (item.quantidade <= item.minimo) return "critico";
  if (item.quantidade <= item.minimo * 1.5) return "baixo";
  return "ok";
}

const STATUS = {
  ok:      { bg: "#0D2B1F", border: "#10B981", badge: "#10B981", label: "Ok",      icon: CheckCircle  },
  baixo:   { bg: "#2B1E09", border: "#F59E0B", badge: "#F59E0B", label: "Baixo",   icon: AlertTriangle },
  critico: { bg: "#2B0D0D", border: "#EF4444", badge: "#EF4444", label: "Crítico", icon: XCircle      },
  zero:    { bg: "#1A0D0D", border: "#7F1D1D", badge: "#DC2626", label: "Zerado",  icon: XCircle      },
};

// ─── PIN ─────────────────────────────────────────────────────────────────────
function ModalPIN({ cor, onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const PIN = "1234";

  function digit(d) {
    if (pin.length >= 4) return;
    const n = pin + d;
    setPin(n);
    if (n.length === 4) setTimeout(() => { if (n === PIN) onSuccess(); else { setErro("PIN incorreto"); setPin(""); } }, 200);
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(6px)" }}>
      <div style={{ background:"#1E293B",borderRadius:24,padding:"40px 32px",width:"min(360px,90vw)",textAlign:"center",border:"1px solid #334155",boxShadow:"0 32px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ width:64,height:64,borderRadius:999,background:`${cor}22`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px" }}>
          <Lock size={28} color={cor} />
        </div>
        <h2 style={{ color:"#F1F5F9",fontSize:20,fontWeight:700,marginBottom:6 }}>Digite o PIN</h2>
        <p style={{ color:"#64748B",fontSize:14,marginBottom:28 }}>Acesso ao modo estoque</p>
        <div style={{ display:"flex",gap:12,justifyContent:"center",marginBottom:28 }}>
          {[0,1,2,3].map(i=><div key={i} style={{ width:18,height:18,borderRadius:999,background:i<pin.length?cor:"#334155",transition:"background 150ms",boxShadow:i<pin.length?`0 0 8px ${cor}`:"none" }}/>)}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16 }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
            <button key={i} onClick={()=>d==="⌫"?setPin(p=>p.slice(0,-1)):d!==""?digit(String(d)):null} disabled={d===""} style={{ height:60,borderRadius:14,fontSize:22,fontWeight:700,background:d===""?"transparent":d==="⌫"?"#334155":"#0F172A",color:d==="⌫"?"#94A3B8":"#F1F5F9",border:"1px solid "+(d===""?"transparent":"#334155"),cursor:d===""?"default":"pointer" }}>{d}</button>
          ))}
        </div>
        {erro && <p style={{ color:"#EF4444",fontSize:13,fontWeight:600,marginBottom:12 }}>{erro}</p>}
        <button onClick={onClose} style={{ color:"#64748B",fontSize:13,fontWeight:600,background:"none",border:"none",cursor:"pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

// ─── Modal Retirada ───────────────────────────────────────────────────────────
function ModalRetirada({ item, funcionarios, fichas, cor, onConfirmar, onClose, loading }) {
  const [funcId, setFuncId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [qtd,    setQtd]    = useState(1);
  const [erro,   setErro]   = useState("");
  const func = funcionarios.find(f=>f.id===funcId);

  async function ok() {
    if (!funcId) return setErro("Selecione o funcionário.");
    if (!motivo) return setErro("Selecione a receita/motivo.");
    if (qtd<=0)  return setErro("Quantidade inválida.");
    setErro(""); await onConfirmar({ funcId, func, motivo, qtd });
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)",padding:16 }}>
      <div style={{ background:"#1E293B",borderRadius:24,width:"min(480px,100%)",border:"1px solid #334155",boxShadow:"0 32px 64px rgba(0,0,0,0.5)",overflow:"hidden" }}>
        <div style={{ padding:"20px 24px",borderBottom:"1px solid #334155",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:"rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center" }}><PackageMinus size={20} color="#EF4444"/></div>
            <div><p style={{ color:"#94A3B8",fontSize:12,fontWeight:600 }}>RETIRADA</p><p style={{ color:"#F1F5F9",fontSize:18,fontWeight:700 }}>{item.nome}</p></div>
          </div>
          <button onClick={onClose} style={{ color:"#64748B",background:"none",border:"none",cursor:"pointer" }}><X size={22}/></button>
        </div>
        <div style={{ padding:24,display:"flex",flexDirection:"column",gap:18 }}>
          {/* Funcionário */}
          <div>
            <label style={{ display:"flex",alignItems:"center",gap:6,color:"#64748B",fontSize:12,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em" }}><User size={14}/> Quem está retirando?</label>
            <select value={funcId} onChange={e=>{setFuncId(e.target.value);setErro("");}} style={{ width:"100%",height:52,padding:"0 16px",borderRadius:12,background:"#0F172A",border:"1.5px solid #334155",color:funcId?"#F1F5F9":"#64748B",fontSize:16,fontWeight:600,outline:"none",cursor:"pointer" }}>
              <option value="">Selecione...</option>
              {funcionarios.map(f=><option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
            </select>
          </div>
          {/* Quantidade */}
          <div>
            <label style={{ color:"#64748B",fontSize:12,fontWeight:700,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em" }}>Quantidade ({item.unidade})</label>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <button onClick={()=>setQtd(q=>Math.max(0.5,q-(q>1?1:0.5)))} style={{ width:52,height:52,borderRadius:12,background:"#334155",border:"none",color:"#F1F5F9",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Minus size={20}/></button>
              <input type="number" value={qtd} min="0.1" step="0.5" onChange={e=>setQtd(Math.max(0.1,Number(e.target.value)))} style={{ flex:1,height:52,textAlign:"center",borderRadius:12,background:"#0F172A",border:"1.5px solid #334155",color:"#F1F5F9",fontSize:22,fontWeight:700,outline:"none" }}/>
              <button onClick={()=>setQtd(q=>q+1)} style={{ width:52,height:52,borderRadius:12,background:"#334155",border:"none",color:"#F1F5F9",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Plus size={20}/></button>
            </div>
            <p style={{ color:"#475569",fontSize:12,marginTop:6 }}>Disponível: {Number(item.quantidade||0).toLocaleString("pt-BR",{maximumFractionDigits:2})} {item.unidade}</p>
          </div>
          {/* Receita */}
          <div>
            <label style={{ display:"flex",alignItems:"center",gap:6,color:"#64748B",fontSize:12,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em" }}><BookOpen size={14}/> Para qual receita?</label>
            {fichas.length===0
              ? <p style={{ color:"#EF4444",fontSize:13,padding:"12px 0" }}>Nenhuma ficha técnica cadastrada.</p>
              : <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:180,overflowY:"auto" }}>
                  {fichas.map(f=>(
                    <button key={f.id} onClick={()=>{setMotivo(f.nome);setErro("");}} style={{ padding:"12px 16px",borderRadius:12,textAlign:"left",background:motivo===f.nome?`${cor}22`:"#0F172A",border:`1.5px solid ${motivo===f.nome?cor:"#334155"}`,color:motivo===f.nome?cor:"#94A3B8",fontSize:15,fontWeight:600,cursor:"pointer",transition:"all 150ms" }}>
                      {motivo===f.nome&&<span style={{ marginRight:8 }}>✓</span>}{f.nome}
                    </button>
                  ))}
                </div>
            }
          </div>
          {erro && <p style={{ background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"10px 14px",color:"#EF4444",fontSize:13,fontWeight:600 }}>{erro}</p>}
          <div style={{ display:"flex",gap:12 }}>
            <button onClick={onClose} style={{ flex:1,height:52,borderRadius:14,background:"#334155",border:"none",color:"#94A3B8",fontSize:16,fontWeight:700,cursor:"pointer" }}>Cancelar</button>
            <button onClick={ok} disabled={loading} style={{ flex:2,height:52,borderRadius:14,background:loading?"#475569":"#EF4444",border:"none",color:"#fff",fontSize:16,fontWeight:700,cursor:loading?"default":"pointer" }}>{loading?"Registrando...":`Retirar ${qtd} ${item.unidade}`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Entrada ────────────────────────────────────────────────────────────
function ModalEntrada({ item, cor, onConfirmar, onClose, loading }) {
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)",padding:16 }}>
      <div style={{ background:"#1E293B",borderRadius:24,width:"min(420px,100%)",border:"1px solid #334155",overflow:"hidden" }}>
        <div style={{ padding:"20px 24px",borderBottom:"1px solid #334155",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:`${cor}22`,display:"flex",alignItems:"center",justifyContent:"center" }}><PackagePlus size={20} color={cor}/></div>
            <div><p style={{ color:"#94A3B8",fontSize:12,fontWeight:600 }}>ENTRADA</p><p style={{ color:"#F1F5F9",fontSize:18,fontWeight:700 }}>{item.nome}</p></div>
          </div>
          <button onClick={onClose} style={{ color:"#64748B",background:"none",border:"none",cursor:"pointer" }}><X size={22}/></button>
        </div>
        <div style={{ padding:24,display:"flex",flexDirection:"column",gap:18 }}>
          <div>
            <label style={{ color:"#64748B",fontSize:12,fontWeight:700,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em" }}>Quantidade ({item.unidade})</label>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <button onClick={()=>setQtd(q=>Math.max(0.5,q-(q>1?1:0.5)))} style={{ width:52,height:52,borderRadius:12,background:"#334155",border:"none",color:"#F1F5F9",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Minus size={20}/></button>
              <input type="number" value={qtd} min="0.1" step="0.5" onChange={e=>setQtd(Math.max(0.1,Number(e.target.value)))} style={{ flex:1,height:52,textAlign:"center",borderRadius:12,background:"#0F172A",border:"1.5px solid #334155",color:"#F1F5F9",fontSize:22,fontWeight:700,outline:"none" }}/>
              <button onClick={()=>setQtd(q=>q+1)} style={{ width:52,height:52,borderRadius:12,background:"#334155",border:"none",color:"#F1F5F9",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Plus size={20}/></button>
            </div>
          </div>
          <div>
            <label style={{ color:"#64748B",fontSize:12,fontWeight:700,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em" }}>Observação (opcional)</label>
            <input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: Chegou nota fiscal..." style={{ width:"100%",height:52,padding:"0 16px",borderRadius:12,background:"#0F172A",border:"1.5px solid #334155",color:"#F1F5F9",fontSize:15,outline:"none" }}/>
          </div>
          <div style={{ display:"flex",gap:12 }}>
            <button onClick={onClose} style={{ flex:1,height:52,borderRadius:14,background:"#334155",border:"none",color:"#94A3B8",fontSize:16,fontWeight:700,cursor:"pointer" }}>Cancelar</button>
            <button onClick={()=>onConfirmar({qtd,obs})} disabled={loading} style={{ flex:2,height:52,borderRadius:14,background:loading?"#475569":cor,border:"none",color:"#fff",fontSize:16,fontWeight:700,cursor:loading?"default":"pointer" }}>{loading?"Registrando...":`Adicionar ${qtd} ${item.unidade}`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, tipo, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3000); return()=>clearTimeout(t); },[onClose]);
  return (
    <div style={{ position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:tipo==="ok"?"#10B981":"#EF4444",color:"#fff",borderRadius:14,padding:"14px 24px",fontSize:15,fontWeight:700,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",display:"flex",alignItems:"center",gap:10 }}>
      {tipo==="ok"?<CheckCircle size={18}/>:<XCircle size={18}/>} {msg}
    </div>
  );
}

// ─── Componente Principal (exportado) ─────────────────────────────────────────
export default function TabletSetor({ setor, titulo, emoji, cor, voltarHref }) {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();

  const [aba,          setAba]          = useState("estoque");
  const [itens,        setItens]        = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [fichas,       setFichas]       = useState([]);
  const [historico,    setHistorico]    = useState([]);
  const [busca,        setBusca]        = useState("");
  const [loading,      setLoading]      = useState(true);
  const [pinOk,        setPinOk]        = useState(false);
  const [modalRetira,  setModalRetira]  = useState(null);
  const [modalEntrada, setModalEntrada] = useState(null);
  const [salvando,     setSalvando]     = useState(false);
  const [toast,        setToast]        = useState(null);
  const [filtroHist,   setFiltroHist]   = useState("todos");

  const carregar = useCallback(async () => {
    setLoading(true);
    const [resE, resF, resH] = await Promise.all([
      fetchEstoque(unidadeAtiva),
      fetchFuncionarios(unidadeAtiva),
      fetchHistoricoTablet(unidadeAtiva, 150),
    ]);
    // Filtra pelo setor
    const todos = resE.data || [];
    setItens(setor ? todos.filter(i => !i.setor || i.setor === setor || i.setor?.toLowerCase() === setor.toLowerCase()) : todos);
    setFuncionarios((resF.data || []).filter(f => f.ativo !== false));
    setHistorico(resH.data || []);
    if (isSupabaseReady()) {
      const { data } = await supabase.from("fichas_tecnicas").select("id, nome").order("nome");
      setFichas(data || []);
    }
    setLoading(false);
  }, [unidadeAtiva, setor]);

  useEffect(() => { if (pinOk) carregar(); }, [pinOk, carregar]);

  const visiveis = itens.filter(i => i.nome?.toLowerCase().includes(busca.toLowerCase()));
  const histVis  = historico.filter(h => filtroHist === "todos" || h.tipo === filtroHist);

  async function confirmarRetirada({ funcId, func, motivo, qtd }) {
    setSalvando(true);
    const { error, novaQtd } = await movimentarTablet(modalRetira.id, "saida", qtd, { responsavel: func?.nome||"", cargo: func?.cargo||"", motivo, tipo_motivo:"receita" }, unidadeAtiva);
    setSalvando(false);
    if (error) { setToast({ msg:"Erro: "+error, tipo:"erro" }); return; }
    setItens(p => p.map(i => i.id===modalRetira.id ? {...i, quantidade:novaQtd} : i));
    setHistorico(p => [{ id:Date.now(), estoque_id:modalRetira.id, tipo:"saida", quantidade:qtd, created_at:new Date().toISOString(), estoque:{nome:modalRetira.nome,unidade:modalRetira.unidade}, meta:{responsavel:func?.nome||"",cargo:func?.cargo||"",motivo,tipo_motivo:"receita",via:"tablet"} }, ...p]);
    setModalRetira(null);
    setToast({ msg:`Retirada de ${qtd} ${modalRetira.unidade} registrada!`, tipo:"ok" });
  }

  async function confirmarEntrada({ qtd, obs }) {
    setSalvando(true);
    const { error, novaQtd } = await movimentarTablet(modalEntrada.id, "entrada", qtd, { responsavel:"", cargo:"", motivo:obs||"Entrada manual", tipo_motivo:"livre" }, unidadeAtiva);
    setSalvando(false);
    if (error) { setToast({ msg:"Erro: "+error, tipo:"erro" }); return; }
    setItens(p => p.map(i => i.id===modalEntrada.id ? {...i, quantidade:novaQtd} : i));
    setHistorico(p => [{ id:Date.now(), estoque_id:modalEntrada.id, tipo:"entrada", quantidade:qtd, created_at:new Date().toISOString(), estoque:{nome:modalEntrada.nome,unidade:modalEntrada.unidade}, meta:{responsavel:"",cargo:"",motivo:obs||"Entrada manual",tipo_motivo:"livre",via:"tablet"} }, ...p]);
    setModalEntrada(null);
    setToast({ msg:`Entrada de ${qtd} ${modalEntrada.unidade} registrada!`, tipo:"ok" });
  }

  if (!pinOk) {
    return (
      <div style={{ minHeight:"100vh",background:"#0F172A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
        <div style={{ textAlign:"center",marginBottom:32 }}>
          <div style={{ fontSize:52,marginBottom:12 }}>{emoji}</div>
          <h1 style={{ color:"#F1F5F9",fontSize:26,fontWeight:800,margin:0 }}>Modo {titulo}</h1>
          <p style={{ color:"#475569",fontSize:15,marginTop:6 }}>{unidadeInfo?.nome||""}</p>
        </div>
        <ModalPIN cor={cor} onSuccess={()=>setPinOk(true)} onClose={()=>router.push(voltarHref)}/>
        <button onClick={()=>router.push(voltarHref)} style={{ marginTop:40,color:"#475569",fontSize:14,fontWeight:600,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}><ArrowLeft size={16}/>Voltar</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh",background:"#0F172A",fontFamily:"'Inter',sans-serif" }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.setor-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}@media(max-width:600px){.setor-grid{grid-template-columns:1fr 1fr}}`}</style>

      {/* Header */}
      <div style={{ background:"#1E293B",borderBottom:"1px solid #334155",padding:"16px 20px",display:"flex",alignItems:"center",gap:16,position:"sticky",top:0,zIndex:100 }}>
        <button onClick={()=>router.push(voltarHref)} style={{ color:"#64748B",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center" }}><ChevronLeft size={20}/></button>
        <div style={{ display:"flex",alignItems:"center",gap:10,flex:1 }}>
          <span style={{ fontSize:24 }}>{emoji}</span>
          <div>
            <p style={{ color:"#F1F5F9",fontSize:17,fontWeight:800,margin:0 }}>Sala {titulo}</p>
            <p style={{ color:"#475569",fontSize:12,margin:0 }}>{unidadeInfo?.nome}</p>
          </div>
        </div>
        <div style={{ display:"flex",background:"#0F172A",borderRadius:12,padding:4,gap:4 }}>
          {[{id:"estoque",label:"Estoque",Icon:Layers},{id:"historico",label:"Histórico",Icon:Clock}].map(({id,label,Icon})=>(
            <button key={id} onClick={()=>setAba(id)} style={{ padding:"8px 16px",borderRadius:10,fontSize:13,fontWeight:700,background:aba===id?"#334155":"transparent",color:aba===id?"#F1F5F9":"#475569",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 150ms" }}>
              <Icon size={15}/>{label}
            </button>
          ))}
        </div>
        <button onClick={carregar} style={{ color:"#475569",background:"none",border:"none",cursor:"pointer" }}><RotateCcw size={18}/></button>
      </div>

      {/* ABA ESTOQUE */}
      {aba==="estoque" && (
        <div style={{ padding:"20px 16px",maxWidth:1200,margin:"0 auto" }}>
          <div style={{ position:"relative",marginBottom:20 }}>
            <Search size={18} style={{ position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#475569" }}/>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder={`Buscar ingrediente do ${titulo}...`} autoFocus style={{ width:"100%",height:52,paddingLeft:48,paddingRight:16,background:"#1E293B",border:"1.5px solid #334155",borderRadius:14,color:"#F1F5F9",fontSize:16,outline:"none" }}/>
            {busca && <button onClick={()=>setBusca("")} style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#64748B",background:"none",border:"none",cursor:"pointer" }}><X size={16}/></button>}
          </div>

          {loading ? (
            <div style={{ textAlign:"center",padding:"60px 0",color:"#475569",fontSize:16 }}>Carregando...</div>
          ) : visiveis.length===0 ? (
            <div style={{ textAlign:"center",padding:"60px 0",color:"#475569" }}>
              <span style={{ fontSize:48,opacity:.3 }}>{emoji}</span>
              <p style={{ fontSize:16,fontWeight:600,marginTop:12 }}>Nenhum ingrediente do {titulo}</p>
              <p style={{ fontSize:13,color:"#334155",marginTop:4 }}>Cadastre ingredientes com setor "{setor}" em Ingredientes</p>
            </div>
          ) : (
            <div className="setor-grid">
              {visiveis.map(item=>{
                const st=statusItem(item);
                const s=STATUS[st];
                const Icon=s.icon;
                return (
                  <div key={item.id} style={{ background:s.bg,border:`1.5px solid ${s.border}`,borderRadius:18,padding:"16px 16px 14px",display:"flex",flexDirection:"column",gap:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8 }}>
                      <p style={{ color:"#F1F5F9",fontSize:16,fontWeight:700,margin:0,lineHeight:1.3 }}>{item.nome}</p>
                      <div style={{ display:"flex",alignItems:"center",gap:4,flexShrink:0,background:`${s.badge}22`,borderRadius:8,padding:"3px 8px" }}>
                        <Icon size={12} color={s.badge}/><span style={{ color:s.badge,fontSize:11,fontWeight:700 }}>{s.label}</span>
                      </div>
                    </div>
                    <div>
                      <p style={{ color:s.badge,fontSize:26,fontWeight:800,margin:0,lineHeight:1 }}>
                        {Number(item.quantidade||0).toLocaleString("pt-BR",{maximumFractionDigits:2})}
                        <span style={{ fontSize:14,fontWeight:600,marginLeft:4,color:"#64748B" }}>{item.unidade}</span>
                      </p>
                      <p style={{ color:"#475569",fontSize:11,margin:"3px 0 0" }}>Mín: {item.minimo||0} {item.unidade}</p>
                    </div>
                    <div style={{ display:"flex",gap:8,marginTop:2 }}>
                      <button onClick={()=>setModalEntrada(item)} style={{ flex:1,height:46,borderRadius:12,fontSize:13,fontWeight:700,background:`${cor}22`,border:`1px solid ${cor}44`,color:cor,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><Plus size={16}/>Entrada</button>
                      <button onClick={()=>setModalRetira(item)} style={{ flex:1,height:46,borderRadius:12,fontSize:13,fontWeight:700,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:"#EF4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><Minus size={16}/>Retirada</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA HISTÓRICO */}
      {aba==="historico" && (
        <div style={{ padding:"20px 16px",maxWidth:900,margin:"0 auto" }}>
          <div style={{ display:"flex",gap:8,marginBottom:20 }}>
            {[{id:"todos",label:"Todos"},{id:"saida",label:"Retiradas"},{id:"entrada",label:"Entradas"}].map(f=>(
              <button key={f.id} onClick={()=>setFiltroHist(f.id)} style={{ padding:"8px 18px",borderRadius:10,fontSize:13,fontWeight:700,background:filtroHist===f.id?"#334155":"transparent",color:filtroHist===f.id?"#F1F5F9":"#475569",border:`1.5px solid ${filtroHist===f.id?"#475569":"#1E293B"}`,cursor:"pointer",transition:"all 150ms" }}>{f.label}</button>
            ))}
          </div>
          {histVis.length===0 ? (
            <div style={{ textAlign:"center",padding:"60px 0",color:"#475569" }}><Clock size={48} style={{ opacity:.3,marginBottom:12 }}/><p style={{ fontSize:16,fontWeight:600 }}>Nenhuma movimentação ainda</p></div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {histVis.map((h,idx)=>{
                const entrada=h.tipo==="entrada";
                return (
                  <div key={h.id||idx} style={{ background:"#1E293B",borderRadius:16,border:`1px solid ${entrada?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)"}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14 }}>
                    <div style={{ width:44,height:44,borderRadius:12,flexShrink:0,background:entrada?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      {entrada?<PackagePlus size={20} color="#10B981"/>:<PackageMinus size={20} color="#EF4444"/>}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                        <p style={{ color:"#F1F5F9",fontSize:15,fontWeight:700,margin:0 }}>{h.estoque?.nome||"—"}</p>
                        <span style={{ fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:8,background:entrada?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.15)",color:entrada?"#10B981":"#EF4444" }}>
                          {entrada?"+":"-"}{Number(h.quantidade).toLocaleString("pt-BR",{maximumFractionDigits:2})} {h.estoque?.unidade}
                        </span>
                      </div>
                      <div style={{ display:"flex",flexWrap:"wrap",gap:"4px 16px" }}>
                        {h.meta?.responsavel&&<span style={{ color:"#64748B",fontSize:12,display:"flex",alignItems:"center",gap:4 }}><User size={11}/>{h.meta.responsavel}{h.meta.cargo&&` · ${h.meta.cargo}`}</span>}
                        {h.meta?.motivo&&<span style={{ color:"#64748B",fontSize:12,display:"flex",alignItems:"center",gap:4 }}><BookOpen size={11}/>{h.meta.motivo}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <p style={{ color:"#94A3B8",fontSize:13,fontWeight:700,margin:0 }}>{fmtHora(h.created_at)}</p>
                      <p style={{ color:"#475569",fontSize:11,margin:"2px 0 0" }}>{fmtData(h.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modalRetira&&<ModalRetirada item={modalRetira} funcionarios={funcionarios} fichas={fichas} cor={cor} onConfirmar={confirmarRetirada} onClose={()=>setModalRetira(null)} loading={salvando}/>}
      {modalEntrada&&<ModalEntrada item={modalEntrada} cor={cor} onConfirmar={confirmarEntrada} onClose={()=>setModalEntrada(null)} loading={salvando}/>}
      {toast&&<Toast msg={toast.msg} tipo={toast.tipo} onClose={()=>setToast(null)}/>}
    </div>
  );
}
