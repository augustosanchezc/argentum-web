// HTML del panel de administración (servido por routes/admin.ts en /admin/).
// SPA vanilla con pestañas Personajes / NPCs / Items / Online, tema azul
// (arte 4) para coincidir con el juego. Gateado a rol Dios (3) en el server.

export const PANEL_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Argentum Web — Administración</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px/1.45 "Segoe UI", system-ui, sans-serif; background: #0b0a0f; color: #d2cee2; }
  header { padding: 12px 20px; background: #14131c; border-bottom: 1px solid #2b2938; display: flex; gap: 16px; align-items: center; }
  h1 { font-size: 15px; margin: 0; color: #f1f0f6; font-weight: 800; }
  main { padding: 18px; max-width: 1280px; margin: 0 auto; }
  input, select, button { font: inherit; background: #0d0c13; color: #e8e6f2; border: 1px solid #33313f; border-radius: 7px; padding: 7px 9px; }
  button { cursor: pointer; font-weight: 700; } button:hover { background: #1c1b28; }
  .btn-primary { background: linear-gradient(#3f7fe0,#2f6fd6); border-color: #4f8ff0; color: #fff; }
  .btn-primary:hover { background: linear-gradient(#4f8ff0,#3f7fe0); }
  .btn-sm { padding: 4px 9px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #0d0c13; border: 1px solid #2a2836; border-radius: 10px; overflow: hidden; }
  th, td { padding: 7px 10px; border-bottom: 1px solid #201f2a; text-align: left; }
  th { color: #8a86a4; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; position: sticky; top: 0; background: #16151e; }
  tr:hover td { background: #16151e; }
  .online { color: #6fe06f; } .offline { color: #6a6784; }
  .gold { color: #7ab0ff; } .muted { color: #8a86a4; }
  #status { margin-left: auto; color: #8a86a4; }
  .hidden { display: none !important; }
  #login { max-width: 340px; margin: 80px auto; padding: 24px; background: #14131c; border: 1px solid #2b2938; border-radius: 14px; display: flex; flex-direction: column; gap: 10px; }
  .tabs { display: flex; gap: 8px; margin-bottom: 6px; }
  .tab { background: #16151e; border: 1px solid #2b2a38; color: #b8b4cc; padding: 8px 18px; border-radius: 9px; }
  .tab.active { background: linear-gradient(#3f7fe0,#2f6fd6); border-color: #4f8ff0; color: #fff; }
  .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
  .toolbar input[type=text] { flex: 1; }
  #modal { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: none; align-items: center; justify-content: center; z-index: 50; }
  #modal.open { display: flex; }
  .card { width: 640px; max-width: 94vw; max-height: 92vh; overflow: auto; background: #14131c; border: 1px solid #2b2938; border-radius: 14px; padding: 16px 18px; }
  .card h2 { margin: 0 0 4px; font-size: 16px; color: #f1f0f6; }
  .card__close { float: right; width: 28px; height: 28px; border-radius: 50%; background: #1e1c2a; border: 1px solid #3b3852; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 12px; margin: 10px 0; }
  .fld { display: flex; flex-direction: column; gap: 3px; }
  .fld label { font-size: 10px; color: #8a86a4; text-transform: uppercase; letter-spacing: .5px; }
  .fld input, .fld select { width: 100%; }
  .sect { margin-top: 14px; padding-top: 12px; border-top: 1px solid #2a2836; }
  .sect h3 { margin: 0 0 8px; font-size: 12px; color: #b8b4cc; text-transform: uppercase; letter-spacing: 1px; }
  .give-results { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }
  .give-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #16151e; border: 1px solid #2b2a38; border-radius: 8px; cursor: pointer; }
  .give-row:hover { border-color: #2f6fd6; }
  .give-row .name { flex: 1; } .give-row .id { color: #6a6784; font-size: 11px; }
  .ph { width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0d0c13; border: 1px solid #2b2a38; border-radius: 8px; }
  td .ph { margin: 0; }
  .filters { display: flex; gap: 6px; align-items: center; margin: 8px 0 2px; flex-wrap: wrap; }
  .filters .lbl { color: #8a86a4; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-right: 4px; }
  .fbtn { padding: 4px 12px; font-size: 12px; font-weight: 700; color: #b8b4cc; background: #16151e; border: 1px solid #2b2a38; border-radius: 8px; cursor: pointer; }
  .fbtn:hover { background: #1c1b28; }
  .fbtn.active { color: #fff; background: linear-gradient(#3f7fe0,#2f6fd6); border-color: #4f8ff0; }
</style>
</head>
<body>
<header>
  <h1>Argentum Web · Administración</h1>
  <span id="status"></span>
  <button id="logoutBtn" class="btn-sm hidden">Salir</button>
</header>

<div id="login">
  <strong>Ingresar (cuenta administrador)</strong>
  <input id="email" type="email" placeholder="email" autocomplete="username">
  <input id="password" type="password" placeholder="contraseña" autocomplete="current-password">
  <button id="loginBtn" class="btn-primary">Entrar</button>
  <div id="loginError" style="color:#ff6b6b"></div>
</div>

<main id="app" class="hidden">
  <div class="tabs">
    <button class="tab active" data-tab="chars">Personajes</button>
    <button class="tab" data-tab="creatures">Criaturas</button>
    <button class="tab" data-tab="npcs">NPCs</button>
    <button class="tab" data-tab="items">Items</button>
    <button class="tab" data-tab="online">Online</button>
    <button class="tab" data-tab="spawns">Spawns</button>
    <button class="tab" data-tab="ajustes">Ajustes</button>
  </div>

  <section id="tab-chars">
    <div class="toolbar">
      <input id="cSearch" type="text" placeholder="buscar personaje por nombre…">
      <button id="cRefresh">↻</button>
      <label class="muted"><input type="checkbox" id="onlyOnline"> solo online</label>
    </div>
    <table><thead><tr>
      <th>ID</th><th>Personaje</th><th>Nv</th><th>Clase</th><th>Oro</th><th>Facción</th>
      <th>Clan</th><th>Mapa</th><th>Estado</th><th>Cuenta</th><th></th>
    </tr></thead><tbody id="cRows"></tbody></table>
  </section>

  <section id="tab-creatures" class="hidden">
    <div class="toolbar"><input id="crSearch" type="text" placeholder="buscar criatura por nombre o número…"><button id="crRefresh">↻</button></div>
    <div class="filters"><span class="lbl">Hostil</span>
      <button class="fbtn active" data-crh="">Todos</button>
      <button class="fbtn" data-crh="1">Sí</button>
      <button class="fbtn" data-crh="0">No</button>
    </div>
    <div class="filters" style="border-top:1px solid #2b2a38;padding-top:8px">
      <span class="lbl">Masivo</span>
      <label style="font-size:12px;color:#b8b4cc">×</label>
      <input id="bulkMult" type="number" min="0.1" step="0.5" value="7" style="width:80px">
      <label style="font-size:12px;color:#b8b4cc;display:flex;align-items:center;gap:4px"><input type="checkbox" id="bulkExp" checked> Exp</label>
      <label style="font-size:12px;color:#b8b4cc;display:flex;align-items:center;gap:4px"><input type="checkbox" id="bulkGold" checked> Oro</label>
      <button class="fbtn" id="bulkApply" style="color:#fff;background:linear-gradient(#3f7fe0,#2f6fd6);border-color:#4f8ff0">Aplicar a todas</button>
    </div>
    <table><thead><tr>
      <th>Foto</th><th>#</th><th>Nombre</th><th>HP</th><th>Golpe</th><th>Def</th><th>Exp</th><th>Oro</th><th>Hostil</th><th></th>
    </tr></thead><tbody id="crRows"></tbody></table>
  </section>

  <section id="tab-npcs" class="hidden">
    <div class="toolbar"><input id="nSearch" type="text" placeholder="buscar NPC por nombre o número…"><button id="nRefresh">↻</button></div>
    <div class="filters" id="nFilters"><span class="lbl">Tipo</span>
      <button class="fbtn active" data-nsub="">Todos</button>
      <button class="fbtn" data-nsub="vendedor">Vendedor</button>
      <button class="fbtn" data-nsub="banquero">Banquero</button>
      <button class="fbtn" data-nsub="sacerdote">Sacerdote</button>
      <button class="fbtn" data-nsub="guardia">Guardia</button>
      <button class="fbtn" data-nsub="otro">Otro</button>
    </div>
    <table><thead><tr>
      <th>Foto</th><th>#</th><th>Nombre</th><th>Tipo</th><th>HP</th><th>Golpe</th><th>Def</th><th>Vende</th><th></th>
    </tr></thead><tbody id="nRows"></tbody></table>
  </section>

  <section id="tab-items" class="hidden">
    <div class="toolbar"><input id="iSearch" type="text" placeholder="buscar item por nombre o id…"><button id="iRefresh">↻</button></div>
    <div class="filters"><span class="lbl">Tipo</span>
      <button class="fbtn active" data-itype="">Todos</button>
      <button class="fbtn" data-itype="weapon">Armas</button>
      <button class="fbtn" data-itype="armor">Armaduras</button>
      <button class="fbtn" data-itype="helmet">Cascos</button>
      <button class="fbtn" data-itype="shield">Escudos</button>
      <button class="fbtn" data-itype="potion">Pociones</button>
      <button class="fbtn" data-itype="food">Comida</button>
      <button class="fbtn" data-itype="drink">Bebida</button>
      <button class="fbtn" data-itype="arrow">Flechas</button>
      <button class="fbtn" data-itype="misc">Misc</button>
    </div>
    <table><thead><tr>
      <th>Foto</th><th>Código</th><th>Nombre</th><th>Tipo</th><th>Valor</th><th>Golpe</th><th>Def</th><th></th>
    </tr></thead><tbody id="iRows"></tbody></table>
  </section>

  <section id="tab-online" class="hidden">
    <div class="toolbar"><button id="oRefresh">↻ Actualizar</button></div>
    <table><thead><tr><th>ID</th><th>Personaje</th><th>Nv</th><th>Mapa</th><th>Pos</th><th>HP</th><th></th></tr></thead><tbody id="oRows"></tbody></table>
  </section>

  <section id="tab-spawns" class="hidden">
    <div class="sect">
      <h3>Respawn aleatorio de criaturas por mapa</h3>
      <div class="muted" style="font-size:12px;margin-bottom:10px">Elegí un mapa y armá el pool de criaturas que pueden reaparecer. Con "Respawn aleatorio" activo, cada criatura del mapa reaparece como una del pool elegida al azar. Sin activar, cada mapa respawnea las criaturas originales del AO. Los comerciantes, guardias y banqueros nunca se randomizan.</div>
      <div class="toolbar">
        <select id="spMap" style="flex:1;max-width:420px"></select>
        <label style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="spEnabled"> Respawn aleatorio</label>
      </div>
      <div id="spNatives" class="muted" style="font-size:12px;margin:8px 0"></div>
      <div class="toolbar" style="margin-bottom:8px">
        <input type="text" id="spSearch" placeholder="buscar criatura…" style="flex:1;max-width:300px">
        <button id="spAddNatives" class="btn-sm">+ Agregar las nativas del mapa</button>
        <button id="spClear" class="btn-sm">Vaciar pool</button>
        <span id="spCount" class="muted" style="font-size:12px"></span>
      </div>
      <div id="spList" style="max-height:360px;overflow:auto;border:1px solid #2b2938;border-radius:8px;padding:6px"></div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn-primary" id="spSave">Guardar mapa</button>
        <span id="spStatus" class="muted" style="font-size:12px"></span>
      </div>
    </div>
  </section>

  <section id="tab-ajustes" class="hidden">
    <div class="sect">
      <h3>Intervalos de jugabilidad (ms)</h3>
      <div class="muted" style="font-size:12px;margin-bottom:10px">Valores del AO Libre real. Editalos y guardá — se aplican en vivo. "Restaurar AO" vuelve a los valores originales.</div>
      <div id="cfgList"></div>
      <div class="toolbar" style="margin-top:12px">
        <button class="btn-primary" id="cfgSave">Guardar cambios</button>
        <button id="cfgReset">Restaurar valores de AO Libre</button>
        <span id="cfgStatus" class="muted" style="font-size:12px"></span>
      </div>
    </div>
  </section>
</main>

<div id="modal"><div class="card" id="modalCard"></div></div>

<script>
var CLASSES = {1:"Guerrero",2:"Mago",3:"Clérigo",4:"Cazador",5:"Asesino",6:"Druida"};
var FACTIONS = {0:"—",1:"Armada Real",2:"Legión Oscura"};
var NPCTYPES = {0:"Criatura",1:"Sacerdote",2:"Guardia",3:"Especial",4:"Banquero",5:"Enlistador",6:"Dragón",7:"Timbero",8:"G. Caos",9:"Artesano",10:"Pretoriano",11:"Gobernador"};
var FIELDS = [
  ["Básico", [["level","Nivel"],["xp","Experiencia"],["gold","Oro"],["statPoints","Pts. stat"]]],
  ["Vida / Maná", [["hp","HP"],["maxHp","HP máx"],["mana","Maná"],["maxMana","Maná máx"]]],
  ["Atributos", [["str","Fuerza"],["agi","Agilidad"],["int_","Inteligencia"],["con","Constitución"],["car","Carisma"]]],
  ["Estado", [["hunger","Hambre"],["thirst","Sed"],["faction","Facción (0-2)"]]],
  ["Ubicación / Apariencia", [["mapId","Mapa"],["posX","X"],["posY","Y"],["bodyId","Cuerpo"],["headId","Cabeza"]]]
];
var token = sessionStorage.getItem("ao_admin_token") || "";
function $(id){ return document.getElementById(id); }
function setStatus(t){ $("status").textContent = t; }
function esc(s){ var d=document.createElement("span"); d.textContent=String(s==null?"":s); return d.innerHTML; }

// ── Sprites (fotos) ──────────────────────────────────────────────────────
var GRH=null, PJ=null;
async function loadSprites(){
  if(GRH) return;
  try{ GRH=await (await fetch("/ao-assets/graficos.json")).json(); PJ=await (await fetch("/ao-assets/personajes.json")).json(); }
  catch(e){ GRH={}; PJ={bodies:{},heads:{},monsterBodies:{}}; }
}
function _rect(grh){ return GRH && GRH[String(grh)]; }
function _css(r){ return "width:"+r.w+"px;height:"+r.h+"px;background:url(/ao-assets/graficos/"+r.f+".png) -"+r.x+"px -"+r.y+"px;image-rendering:pixelated"; }
function itemImg(grh, box){
  var r=_rect(grh); if(!r) return "<div class='ph'></div>";
  var s=Math.min(1, box/r.w, box/r.h);
  return "<div class='ph'><div style='"+_css(r)+";transform:scale("+s+")'></div></div>";
}
function _bodyGrh(body){ if(!PJ) return null; var b=(PJ.monsterBodies&&PJ.monsterBodies[String(body)])||(PJ.bodies&&PJ.bodies[String(body)]); if(!b||!b.walkFrames) return null; var w=b.walkFrames[2]; return (w&&w[0])||null; }
function npcImg(body, head, box){
  var bg=_bodyGrh(body); var br=_rect(bg); if(!br) return "<div class='ph'></div>";
  var s=Math.min(1, box/br.w, box/br.h);
  var b=(PJ.monsterBodies&&PJ.monsterBodies[String(body)])||(PJ.bodies&&PJ.bodies[String(body)]);
  var off=(b&&b.headOffset)||{x:0,y:0};
  var inner="<div style='position:relative;width:"+br.w+"px;height:"+br.h+"px;transform:scale("+s+")'>";
  inner+="<div style='position:absolute;left:0;bottom:0;"+_css(br)+"'></div>";
  var hg=head&&PJ.heads&&PJ.heads[String(head)]?PJ.heads[String(head)].s:null; var hr=_rect(hg);
  if(hr){ inner+="<div style='position:absolute;left:50%;bottom:"+(-off.y)+"px;margin-left:"+(off.x-hr.w/2)+"px;"+_css(hr)+"'></div>"; }
  inner+="</div>";
  return "<div class='ph'>"+inner+"</div>";
}

async function api(path, opts){
  opts = opts || {};
  var res = await fetch(path, Object.assign({}, opts, { headers: Object.assign({ "content-type":"application/json", authorization:"Bearer "+token }, opts.headers||{}) }));
  if (res.status===401 || res.status===403){ logout(); throw new Error("Sin permisos (necesitás rol Dios)"); }
  if (!res.ok) throw new Error("HTTP "+res.status);
  return res.json();
}
function logout(){ token=""; sessionStorage.removeItem("ao_admin_token"); $("app").classList.add("hidden"); $("login").classList.remove("hidden"); $("logoutBtn").classList.add("hidden"); }

$("loginBtn").onclick = async function(){
  $("loginError").textContent="";
  try{
    var res = await fetch("/auth/login", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ email:$("email").value.trim(), password:$("password").value }) });
    if(!res.ok) throw new Error("Credenciales inválidas");
    var data = await res.json();
    if(!data.account.role || data.account.role < 3) throw new Error("Esa cuenta no es administrador (Dios)");
    token = data.token; sessionStorage.setItem("ao_admin_token", token);
    enter(data.account.email);
  }catch(e){ $("loginError").textContent = e.message; }
};
$("logoutBtn").onclick = logout;

function enter(email){
  $("login").classList.add("hidden"); $("app").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden");
  setStatus((email||"sesión activa")+" · Dios");
  loadChars();
}

var tabButtons = document.querySelectorAll(".tab");
for (var i=0;i<tabButtons.length;i++){ tabButtons[i].onclick = function(){
  var t = this.dataset.tab;
  for (var j=0;j<tabButtons.length;j++) tabButtons[j].classList.toggle("active", tabButtons[j].dataset.tab===t);
  ["chars","creatures","npcs","items","online","spawns","ajustes"].forEach(function(x){ $("tab-"+x).classList.toggle("hidden", x!==t); });
  if(t==="chars") loadChars(); else if(t==="creatures") loadCreatures(); else if(t==="npcs") loadNpcs(); else if(t==="items") loadItems(); else if(t==="online") loadOnline(); else if(t==="spawns") loadSpawns(); else loadConfig();
}; }

async function loadChars(){
  var s = $("cSearch").value.trim();
  var rows = await api("/admin/api/characters"+(s?"?search="+encodeURIComponent(s):""));
  if($("onlyOnline").checked) rows = rows.filter(function(r){ return r.online; });
  var b=$("cRows"); b.innerHTML="";
  rows.forEach(function(r){
    var tr=document.createElement("tr");
    tr.innerHTML = "<td>"+r.id+"</td><td><b>"+esc(r.name)+"</b></td><td>"+r.level+"</td><td>"+(CLASSES[r.classId]||r.classId)+"</td>"+
      "<td class='gold'>"+r.gold.toLocaleString()+"</td><td>"+FACTIONS[r.faction]+"</td><td>"+esc(r.guildName||"—")+"</td><td>"+r.mapId+"</td>"+
      "<td class='"+(r.online?"online":"offline")+"'>"+(r.online?"● online":"○ offline")+"</td><td class='muted'>"+esc(r.email)+"</td>"+
      "<td><button class='btn-sm btn-primary' data-edit='"+r.id+"'>Editar</button> "+(r.online?"<button class='btn-sm' data-kick='"+r.id+"'>Kick</button>":"")+"</td>";
    b.appendChild(tr);
  });
  setStatus(rows.length+" personajes · Dios");
}
var npcCache = {};
var crHostile="", nSub="", iType="";
async function loadCreatures(){
  await loadSprites();
  var s=$("crSearch").value.trim();
  var rows = await api("/admin/api/npcs?kind=creature"+(s?"&search="+encodeURIComponent(s):"")+(crHostile?"&hostile="+crHostile:""));
  var b=$("crRows"); b.innerHTML="";
  rows.forEach(function(r){
    npcCache[r.number]=r;
    var tr=document.createElement("tr");
    tr.innerHTML = "<td>"+npcImg(r.body,r.head,40)+"</td><td>"+r.number+"</td><td><b>"+esc(r.name)+"</b></td>"+
      "<td>"+r.maxHp.toLocaleString()+"</td><td>"+r.minHit+"-"+r.maxHit+"</td><td>"+r.def+"</td><td>"+r.giveExp.toLocaleString()+"</td>"+
      "<td class='gold'>"+r.giveGld.toLocaleString()+"</td><td>"+(r.hostile?"sí":"no")+"</td>"+
      "<td><button class='btn-sm btn-primary' data-npc='"+r.number+"'>Editar</button></td>";
    b.appendChild(tr);
  });
  setStatus(rows.length+" criaturas · Dios");
}
function npcSub(r){ if(r.comercia) return "vendedor"; if(r.npcType===4) return "banquero"; if(r.npcType===1) return "sacerdote"; if(r.npcType===2) return "guardia"; return "otro"; }
async function loadNpcs(){
  await loadSprites();
  var s=$("nSearch").value.trim();
  var rows = await api("/admin/api/npcs?kind=npc"+(s?"&search="+encodeURIComponent(s):""));
  if(nSub) rows = rows.filter(function(r){ return npcSub(r)===nSub; });
  var b=$("nRows"); b.innerHTML="";
  rows.forEach(function(r){
    npcCache[r.number]=r;
    var tr=document.createElement("tr");
    tr.innerHTML = "<td>"+npcImg(r.body,r.head,40)+"</td><td>"+r.number+"</td><td><b>"+esc(r.name)+"</b></td><td>"+(r.comercia?"Vendedor":(NPCTYPES[r.npcType]||r.npcType))+"</td>"+
      "<td>"+r.maxHp.toLocaleString()+"</td><td>"+r.minHit+"-"+r.maxHit+"</td><td>"+r.def+"</td>"+
      "<td class='muted'>"+(r.shopItems.length?r.shopItems.length+" items":"—")+"</td>"+
      "<td><button class='btn-sm btn-primary' data-npc='"+r.number+"'>Editar</button></td>";
    b.appendChild(tr);
  });
  setStatus(rows.length+" NPCs · Dios");
}
var itemCache = {};
async function loadItems(){
  await loadSprites();
  var s=$("iSearch").value.trim();
  var qs=[]; if(s) qs.push("search="+encodeURIComponent(s)); if(iType) qs.push("type="+iType);
  var rows = await api("/admin/api/items"+(qs.length?"?"+qs.join("&"):""));
  var b=$("iRows"); b.innerHTML="";
  rows.forEach(function(r){
    itemCache[r.id]=r;
    var tr=document.createElement("tr");
    tr.innerHTML = "<td>"+itemImg(r.graphic,40)+"</td><td><b style='color:#7ab0ff'>"+r.id+"</b></td><td><b>"+esc(r.name)+"</b></td><td>"+esc(r.type)+"</td>"+
      "<td class='gold'>"+r.value.toLocaleString()+"</td><td>"+(r.maxHit?r.minHit+"-"+r.maxHit:"—")+"</td><td>"+(r.defense||"—")+"</td>"+
      "<td><button class='btn-sm btn-primary' data-itemedit='"+r.id+"'>Editar</button> <button class='btn-sm' data-copy='"+r.id+"'>Copiar código</button> <button class='btn-sm' data-give='"+r.id+"' data-gname='"+esc(r.name)+"'>Dar…</button></td>";
    b.appendChild(tr);
  });
  setStatus(rows.length+" items (máx 400) · Dios");
}
function openItem(id){
  var r = itemCache[id]; if(!r) return;
  var fields = [["name","Nombre","text"],["value","Valor (precio)","number"],["minHit","Golpe mín","number"],["maxHit","Golpe máx","number"],["defense","Defensa","number"],["heal","Cura HP","number"],["manaHeal","Cura maná","number"],["damageBonus","Bonus de daño","number"]];
  var html = "<button class='card__close' id='mClose'>✕</button><div style='display:flex;align-items:center;gap:12px'>"+itemImg(r.graphic,44)+"<h2 style='margin:0'>"+esc(r.name)+" <span class='muted' style='font-size:12px'>código "+id+" · "+esc(r.type)+"</span></h2></div>";
  html += "<div class='sect'><div class='grid'>";
  fields.forEach(function(f){ var val=r[f[0]]; html += "<div class='fld'><label>"+f[1]+"</label><input type='"+f[2]+"' data-if='"+f[0]+"' value='"+esc(val==null?0:val)+"'></div>"; });
  html += "</div></div>";
  html += "<div class='sect' style='display:flex;gap:10px;justify-content:flex-end;align-items:center'><span class='muted' style='margin-right:auto;font-size:11px'>Afecta el balance del server al instante · el juego original queda intacto (borrable)</span><button id='mCancel'>Cerrar</button><button class='btn-primary' id='mSaveItem'>Guardar</button></div>";
  $("modalCard").innerHTML = html;
  $("modal").classList.add("open");
  $("mClose").onclick = $("mCancel").onclick = function(){ $("modal").classList.remove("open"); };
  $("mSaveItem").onclick = async function(){
    var body={}; var inputs=$("modalCard").querySelectorAll("input[data-if]");
    for(var k=0;k<inputs.length;k++){ var key=inputs[k].dataset.if; body[key] = key==="name" ? inputs[k].value : Number(inputs[k].value); }
    try{ await api("/admin/api/items/"+id+"/update", { method:"POST", body: JSON.stringify(body) }); alert("Guardado."); $("modal").classList.remove("open"); loadItems(); }
    catch(e){ alert("Error: "+e.message); }
  };
}
async function loadOnline(){
  var rows = await api("/admin/api/online");
  var b=$("oRows"); b.innerHTML="";
  rows.forEach(function(r){
    var tr=document.createElement("tr");
    tr.innerHTML = "<td>"+r.characterId+"</td><td><b>"+esc(r.name)+"</b></td><td>"+r.level+"</td><td>"+r.mapId+"</td>"+
      "<td>"+r.x+","+r.y+"</td><td>"+r.hp+"/"+r.maxHp+"</td><td><button class='btn-sm' data-kick='"+r.characterId+"'>Kick</button></td>";
    b.appendChild(tr);
  });
  setStatus(rows.length+" online · Dios");
}

async function loadConfig(){
  var data = await api("/admin/api/config");
  var list = data.intervals || [];
  $("cfgList").innerHTML = list.map(function(c){
    var changed = c.value !== c.default;
    return "<div class='fld' style='flex-direction:row;align-items:center;gap:10px;margin-bottom:6px'>"+
      "<div style='flex:1'><label style='margin:0'>"+esc(c.label)+"</label><div class='muted' style='font-size:11px'>"+esc(c.desc)+"</div></div>"+
      "<input type='number' data-cfg='"+c.key+"' value='"+c.value+"' min='"+c.min+"' max='"+c.max+"' style='width:110px'>"+
      "<span class='muted' style='font-size:11px;width:120px'>AO: "+c.default+(changed?" <b style='color:#7ab0ff'>(editado)</b>":"")+"</span></div>";
  }).join("");
  $("cfgStatus").textContent = "";
  setStatus("Ajustes de jugabilidad · Dios");
}
async function saveConfig(reset){
  var body;
  if(reset){ if(!confirm("¿Restaurar todos los intervalos a los valores originales de AO Libre?")) return; body={reset:true}; }
  else {
    var intervals={}; var inputs=document.querySelectorAll("[data-cfg]");
    for(var i=0;i<inputs.length;i++) intervals[inputs[i].dataset.cfg]=Number(inputs[i].value);
    body={intervals:intervals};
  }
  try{ await api("/admin/api/config/update", { method:"POST", body: JSON.stringify(body) }); $("cfgStatus").textContent="✓ Aplicado en vivo"; loadConfig(); }
  catch(e){ $("cfgStatus").textContent="Error: "+e.message; }
}

// ── Spawns aleatorios por mapa ─────────────────────────────────────────────
var SP = { maps: [], creatures: [], mapById: {}, nameByNum: {}, pool: {}, filter: "" };
async function loadSpawns(){
  setStatus("Spawns por mapa · Dios");
  var data = await api("/admin/api/map-spawns");
  SP.maps = data.maps || []; SP.creatures = data.creatures || [];
  SP.mapById = {}; SP.nameByNum = {};
  SP.maps.forEach(function(m){ SP.mapById[m.id] = m; });
  SP.creatures.forEach(function(c){ SP.nameByNum[c.number] = c.name; });
  var sel = $("spMap");
  sel.innerHTML = SP.maps.map(function(m){
    var flag = m.enabled ? " ● random" : "";
    return "<option value='"+m.id+"'>Mapa "+m.id+" — "+esc(m.name)+" ("+m.natives.length+" criat.)"+flag+"</option>";
  }).join("");
  if(SP.maps.length){ selectSpawnMap(SP.maps[0].id); } else { $("spList").innerHTML="<div class='muted'>No hay mapas con criaturas.</div>"; }
}
function selectSpawnMap(mapId){
  var m = SP.mapById[mapId]; if(!m) return;
  $("spMap").value = String(mapId);
  $("spEnabled").checked = !!m.enabled;
  SP.pool = {}; (m.pool||[]).forEach(function(n){ SP.pool[n]=true; });
  $("spStatus").textContent = "";
  renderSpawnNatives(m); renderSpawnList();
}
function renderSpawnNatives(m){
  if(!m.natives.length){ $("spNatives").innerHTML = "Este mapa no tiene criaturas nativas."; return; }
  $("spNatives").innerHTML = "<b>Nativas del AO:</b> " + m.natives.map(function(n){
    return "<span style='display:inline-block;background:#1c1b28;border:1px solid #2b2938;border-radius:10px;padding:1px 8px;margin:2px'>"+esc(SP.nameByNum[n]||("#"+n))+"</span>";
  }).join("");
}
function renderSpawnList(){
  var f = SP.filter.trim().toLowerCase();
  var m = SP.mapById[$("spMap").value];
  var nativeSet = {}; if(m) m.natives.forEach(function(n){ nativeSet[n]=true; });
  var rows = SP.creatures.filter(function(c){
    if(!f) return true;
    return c.name.toLowerCase().indexOf(f)>=0 || String(c.number)===f;
  }).map(function(c){
    var on = !!SP.pool[c.number];
    var nat = nativeSet[c.number] ? " <span class='muted' style='font-size:10px'>(nativa)</span>" : "";
    return "<label style='display:flex;align-items:center;gap:8px;padding:3px 4px'><input type='checkbox' data-sp='"+c.number+"'"+(on?" checked":"")+"> "+esc(c.name)+" <span class='muted' style='font-size:11px'>#"+c.number+"</span>"+nat+"</label>";
  });
  $("spList").innerHTML = rows.join("");
  updateSpCount();
}
function updateSpCount(){
  var count = Object.keys(SP.pool).filter(function(k){ return SP.pool[k]; }).length;
  $("spCount").textContent = "Pool: "+count+" criatura(s)";
}
async function saveSpawns(){
  var mapId = Number($("spMap").value);
  var pool = Object.keys(SP.pool).filter(function(k){ return SP.pool[k]; }).map(Number);
  var body = { mapId: mapId, enabled: $("spEnabled").checked, pool: pool };
  try{
    var r = await api("/admin/api/map-spawns/update", { method:"POST", body: JSON.stringify(body) });
    var m = SP.mapById[mapId]; if(m){ m.enabled = r.enabled; m.pool = r.pool; }
    $("spStatus").textContent = "✓ Guardado (aplica al próximo respawn)";
    // Refrescar la etiqueta ● random del selector.
    var opt = $("spMap").options[$("spMap").selectedIndex];
    if(opt){ opt.textContent = "Mapa "+mapId+" — "+m.name+" ("+m.natives.length+" criat.)"+(r.enabled?" ● random":""); }
  }catch(e){ $("spStatus").textContent = "Error: "+e.message; }
}

var giveTargetId = null;
async function openChar(id){
  var c = await api("/admin/api/characters/"+id);
  var html = "<button class='card__close' id='mClose'>✕</button><h2>"+esc(c.name)+" <span class='muted' style='font-size:12px'>#"+c.id+" · "+(CLASSES[c.classId]||c.classId)+" · "+(c.online?"online":"offline")+"</span></h2>";
  FIELDS.forEach(function(group){
    html += "<div class='sect'><h3>"+group[0]+"</h3><div class='grid'>";
    group[1].forEach(function(f){
      var key=f[0], lbl=f[1], val=c[key];
      html += "<div class='fld'><label>"+lbl+"</label><input type='number' data-f='"+key+"' value='"+(val==null?0:val)+"'></div>";
    });
    html += "</div></div>";
  });
  html += "<div class='sect'><h3>Dar item</h3><div class='toolbar'><input type='text' id='giveSearch' placeholder='buscar item…' style='flex:1'><input type='number' id='giveQty' value='1' min='1' style='width:80px'></div><div class='give-results' id='giveResults'></div></div>";
  html += "<div class='sect' style='display:flex;gap:10px;justify-content:flex-end'>"+(c.online?"<button class='btn-sm' data-kick='"+c.id+"' style='margin-right:auto'>Kick (aplicar en vivo)</button>":"")+"<button id='mCancel'>Cerrar</button><button class='btn-primary' id='mSave'>Guardar cambios</button></div>";
  $("modalCard").innerHTML = html;
  $("modal").classList.add("open");
  giveTargetId = c.id;
  $("mClose").onclick = $("mCancel").onclick = function(){ $("modal").classList.remove("open"); };
  $("mSave").onclick = async function(){
    var body={}; var inputs=$("modalCard").querySelectorAll("input[data-f]");
    for(var k=0;k<inputs.length;k++){ body[inputs[k].dataset.f] = Number(inputs[k].value); }
    try{ var r = await api("/admin/api/characters/"+c.id+"/update", { method:"POST", body: JSON.stringify(body) }); alert("Guardado."+(r.online?" Está online: pateá para aplicar posición/inventario en vivo.":"")); $("modal").classList.remove("open"); loadChars(); }
    catch(e){ alert("Error: "+e.message); }
  };
  var gs=$("giveSearch");
  gs.oninput = debounce(async function(){
    var q=gs.value.trim(); if(q.length<2){ $("giveResults").innerHTML=""; return; }
    var items = await api("/admin/api/items?search="+encodeURIComponent(q));
    $("giveResults").innerHTML = items.slice(0,40).map(function(it){ return "<div class='give-row' data-giveitem='"+it.id+"'><span class='name'>"+esc(it.name)+"</span><span class='id'>#"+it.id+" · "+esc(it.type)+"</span></div>"; }).join("");
  }, 250);
}

function debounce(fn, ms){ var t; return function(){ var a=arguments, self=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(self,a); }, ms); }; }
function setFilterActive(btn){ var sibs=btn.parentNode.querySelectorAll(".fbtn"); for(var i=0;i<sibs.length;i++) sibs[i].classList.toggle("active", sibs[i]===btn); }

function openNpc(number){
  var r = npcCache[number]; if(!r) return;
  var isNpc = r.kind==="npc";
  var shop = (r.shop||[]).map(function(x){ return {id:x.id, name:x.name}; });
  var fields = [["name","Nombre","text"],["maxHp","HP máx","number"],["minHit","Golpe mín","number"],["maxHit","Golpe máx","number"],["def","Defensa","number"],["giveExp","Exp que da","number"],["giveGld","Oro que da","number"],["poderAtaque","Poder ataque","number"],["poderEvasion","Poder evasión","number"],["movement","Movimiento (0-4)","number"]];
  var tipoLbl = r.kind==="creature" ? "Criatura" : (r.comercia ? "Vendedor" : (NPCTYPES[r.npcType]||"NPC"));
  var html = "<button class='card__close' id='mClose'>✕</button><div style='display:flex;align-items:center;gap:12px'>"+npcImg(r.body,r.head,44)+"<h2 style='margin:0'>"+esc(r.name)+" <span class='muted' style='font-size:12px'>#"+number+" · "+tipoLbl+"</span></h2></div>";
  html += "<div class='sect'><div class='grid'>";
  fields.forEach(function(f){ var val=r[f[0]]; html += "<div class='fld'><label>"+f[1]+"</label><input type='"+f[2]+"' data-nf='"+f[0]+"' value='"+esc(val==null?"":val)+"'></div>"; });
  html += "</div><div class='fld' style='flex-direction:row;align-items:center;gap:8px;margin-top:8px'><input type='checkbox' id='npcHostile'"+(r.hostile?" checked":"")+"><label style='margin:0'>Hostil (ataca a jugadores)</label></div></div>";
  if(isNpc){
    html += "<div class='sect'><h3>Items que vende</h3><div id='shopList' class='give-results'></div>"+
      "<div class='toolbar' style='margin-top:8px'><input type='number' id='shopAddCode' placeholder='código de item' style='width:150px'><button id='shopAddBtn' type='button'>+ Agregar por código</button></div>"+
      "<div class='toolbar' style='margin-top:6px'><input type='text' id='shopSearch' placeholder='o buscar item por nombre para agregar…' style='flex:1'></div><div class='give-results' id='shopSearchRes'></div></div>";
  }
  if(r.kind==="creature"){
    html += "<div class='sect'><h3>Drops (probabilidad)</h3><div id='dropList'></div>"+
      "<div class='toolbar' style='margin-top:8px'><input type='number' id='dropAddCode' placeholder='código de item' style='width:150px'><button id='dropAddBtn' type='button'>+ Agregar drop</button><span class='muted' style='font-size:11px'>máx 5 · el oro es el item 12</span></div></div>";
  }
  html += "<div class='sect' style='display:flex;gap:10px;justify-content:flex-end;align-items:center'><span class='muted' style='margin-right:auto;font-size:11px'>Aplica a los que aparezcan después (las tiendas ya reflejan los cambios)</span><button id='mCancel'>Cerrar</button><button class='btn-primary' id='mSaveNpc'>Guardar</button></div>";
  $("modalCard").innerHTML = html;
  $("modal").classList.add("open");
  $("mClose").onclick = $("mCancel").onclick = function(){ $("modal").classList.remove("open"); };

  function renderShop(){
    if(!$("shopList")) return;
    $("shopList").innerHTML = shop.length ? shop.map(function(it,ix){ return "<div class='give-row'><span class='name'>"+esc(it.name)+"</span><span class='id'>#"+it.id+"</span><button class='btn-sm' data-shoprm='"+ix+"' style='padding:2px 9px'>✕</button></div>"; }).join("") : "<div class='muted' style='padding:6px'>No vende nada. Agregá items por código o búsqueda.</div>";
  }
  if(isNpc){
    renderShop();
    $("shopAddBtn").onclick = async function(){
      var code = Number($("shopAddCode").value); if(!code) return;
      try{ var items = await api("/admin/api/items?search="+code); var it = items.find(function(x){ return x.id===code; }); if(!it){ alert("No existe un item con código "+code); return; } if(!shop.some(function(s){ return s.id===code; })) shop.push({id:it.id,name:it.name}); $("shopAddCode").value=""; renderShop(); }
      catch(e){ alert("Error: "+e.message); }
    };
    $("shopList").addEventListener("click", function(e){ var rm=e.target.dataset&&e.target.dataset.shoprm; if(rm!=null){ shop.splice(Number(rm),1); renderShop(); } });
    var ss=$("shopSearch");
    ss.oninput = debounce(async function(){ var q=ss.value.trim(); if(q.length<2){ $("shopSearchRes").innerHTML=""; return; } var items=await api("/admin/api/items?search="+encodeURIComponent(q)); $("shopSearchRes").innerHTML = items.slice(0,30).map(function(it){ return "<div class='give-row' data-shopadd='"+it.id+"' data-sname='"+esc(it.name)+"'><span class='name'>"+esc(it.name)+"</span><span class='id'>#"+it.id+"</span></div>"; }).join(""); }, 250);
    $("shopSearchRes").addEventListener("click", function(e){ var el=e.target.closest?e.target.closest("[data-shopadd]"):null; if(!el) return; var iid=Number(el.dataset.shopadd); if(!shop.some(function(s){ return s.id===iid; })) shop.push({id:iid,name:el.dataset.sname}); renderShop(); });
  }

  // Editor de drops (solo criaturas): item, cantidad y probabilidad (%).
  var drops = (r.drops||[]).map(function(d){ return { item:d.item, qty:d.qty, chance:d.chance, name:d.name }; });
  function renderDrops(){
    if(!$("dropList")) return;
    $("dropList").innerHTML = drops.length ? drops.map(function(d,ix){
      return "<div class='give-row' style='gap:8px'>"+
        "<span class='name'>"+esc(d.name||("#"+d.item))+"</span><span class='id'>#"+d.item+"</span>"+
        "<label class='muted' style='font-size:11px'>cant</label><input type='number' data-dqty='"+ix+"' value='"+d.qty+"' style='width:70px'>"+
        "<label class='muted' style='font-size:11px'>prob %</label><input type='number' data-dprob='"+ix+"' value='"+Math.round(d.chance*100)+"' min='0' max='100' style='width:64px'>"+
        "<button class='btn-sm' data-drm='"+ix+"' style='padding:2px 9px'>✕</button></div>";
    }).join("") : "<div class='muted' style='padding:6px'>Sin drops. Agregá items por código (máx 5).</div>";
  }
  if(r.kind==="creature"){
    renderDrops();
    $("dropAddBtn").onclick = async function(){
      if(drops.length>=5){ alert("Máximo 5 drops (MAX_NPC_DROPS del AO)."); return; }
      var code=Number($("dropAddCode").value); if(!code) return;
      try{ var items=await api("/admin/api/items?search="+code); var it=items.find(function(x){ return x.id===code; }); if(!it){ alert("No existe un item con código "+code); return; } drops.push({item:it.id,qty:1,chance:0.2,name:it.name}); $("dropAddCode").value=""; renderDrops(); }
      catch(e){ alert("Error: "+e.message); }
    };
    $("dropList").addEventListener("click", function(e){ var rm=e.target.dataset&&e.target.dataset.drm; if(rm!=null){ drops.splice(Number(rm),1); renderDrops(); } });
    $("dropList").addEventListener("input", function(e){
      var dq=e.target.dataset.dqty, dp=e.target.dataset.dprob;
      if(dq!=null) drops[Number(dq)].qty = Math.max(1, Math.round(Number(e.target.value)||1));
      if(dp!=null) drops[Number(dp)].chance = Math.max(0, Math.min(100, Number(e.target.value)||0))/100;
    });
  }

  $("mSaveNpc").onclick = async function(){
    var body={}; var inputs=$("modalCard").querySelectorAll("input[data-nf]");
    for(var k=0;k<inputs.length;k++){ var key=inputs[k].dataset.nf; body[key] = key==="name" ? inputs[k].value : Number(inputs[k].value); }
    body.hostile = $("npcHostile").checked;
    if(isNpc) body.shopItems = shop.map(function(x){ return x.id; });
    if(r.kind==="creature") body.drops = drops.map(function(d){ return { item:d.item, qty:d.qty, chance:d.chance }; });
    try{ await api("/admin/api/npcs/"+number+"/update", { method:"POST", body: JSON.stringify(body) }); alert("Guardado."); $("modal").classList.remove("open"); if(r.kind==="creature") loadCreatures(); else loadNpcs(); }
    catch(e){ alert("Error: "+e.message); }
  };
}

document.addEventListener("click", async function(e){
  var d = e.target.dataset || {};
  try{
    if(d.crh!=null){ crHostile=d.crh; setFilterActive(e.target); loadCreatures(); return; }
    if(d.nsub!=null){ nSub=d.nsub; setFilterActive(e.target); loadNpcs(); return; }
    if(d.itype!=null){ iType=d.itype; setFilterActive(e.target); loadItems(); return; }
    if(d.copy){ try{ await navigator.clipboard.writeText(String(d.copy)); }catch(_){} e.target.textContent="✓ "+d.copy; setTimeout(function(){ e.target.textContent="Copiar código"; }, 1200); return; }
    if(d.edit){ openChar(d.edit); }
    else if(d.itemedit){ openItem(Number(d.itemedit)); }
    else if(d.npc){ openNpc(Number(d.npc)); }
    else if(d.kick){ await api("/admin/api/characters/"+d.kick+"/kick", { method:"POST", body:"{}" }); if($("modal").classList.contains("open")) $("modal").classList.remove("open"); loadChars(); loadOnline(); }
    else if(d.give){
      var cid = prompt("ID del personaje que recibe '"+d.gname+"':"); if(!cid) return;
      var qty = prompt("Cantidad:", "1"); if(!qty) return;
      await api("/admin/api/characters/"+Number(cid)+"/give", { method:"POST", body: JSON.stringify({ item:Number(d.give), qty:Number(qty) }) });
      alert("Entregado.");
    }
    else if(d.giveitem){
      var q = Number(($("giveQty")||{}).value || 1);
      await api("/admin/api/characters/"+giveTargetId+"/give", { method:"POST", body: JSON.stringify({ item:Number(d.giveitem), qty:q }) });
      alert("Entregado "+q+" al personaje.");
    }
  }catch(err){ alert("Error: "+err.message); }
});

$("cRefresh").onclick = loadChars; $("cSearch").addEventListener("keydown", function(e){ if(e.key==="Enter") loadChars(); });
$("onlyOnline").onchange = loadChars;
$("crRefresh").onclick = loadCreatures; $("crSearch").addEventListener("keydown", function(e){ if(e.key==="Enter") loadCreatures(); });
$("bulkApply").onclick = async function(){
  var mult = parseFloat($("bulkMult").value);
  var doExp = $("bulkExp").checked, doGold = $("bulkGold").checked;
  if(!(mult>0)){ alert("Multiplicador inválido."); return; }
  if(!doExp && !doGold){ alert("Elegí Exp y/o Oro."); return; }
  var what = (doExp?"exp":"")+(doExp&&doGold?" y ":"")+(doGold?"oro":"");
  if(!confirm("Multiplicar "+what+" de TODAS las criaturas ×"+mult+"?\\n\\nSe aplica sobre los valores actuales (repetir compone). Se guarda como override reversible.")) return;
  this.disabled=true; this.textContent="Aplicando…";
  try{
    var res = await api("/admin/api/npcs/bulk-multiply", { method:"POST", body: JSON.stringify({ mult:mult, exp:doExp, gold:doGold, onlyCreatures:true }) });
    alert(res.count+" criaturas actualizadas ×"+mult+".");
    loadCreatures();
  }catch(err){ alert("Error: "+err.message); }
  finally{ this.disabled=false; this.textContent="Aplicar a todas"; }
};
$("nRefresh").onclick = loadNpcs; $("nSearch").addEventListener("keydown", function(e){ if(e.key==="Enter") loadNpcs(); });
$("iRefresh").onclick = loadItems; $("iSearch").addEventListener("keydown", function(e){ if(e.key==="Enter") loadItems(); });
$("oRefresh").onclick = loadOnline;
$("cfgSave").onclick = function(){ saveConfig(false); };
$("cfgReset").onclick = function(){ saveConfig(true); };
$("spMap").onchange = function(){ selectSpawnMap(Number(this.value)); };
$("spSearch").addEventListener("input", function(){ SP.filter = this.value; renderSpawnList(); });
$("spList").addEventListener("change", function(e){
  var cb = e.target; if(!cb || cb.getAttribute("data-sp")===null) return;
  var num = Number(cb.getAttribute("data-sp"));
  if(cb.checked) SP.pool[num]=true; else delete SP.pool[num];
  updateSpCount();
});
$("spAddNatives").onclick = function(){
  var m = SP.mapById[$("spMap").value]; if(!m) return;
  m.natives.forEach(function(n){ SP.pool[n]=true; });
  renderSpawnList();
};
$("spClear").onclick = function(){ SP.pool = {}; renderSpawnList(); };
$("spSave").onclick = saveSpawns;
if(token) enter();
</script>
</body>
</html>`;
