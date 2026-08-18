const $=id=>document.getElementById(id);
const API_BASE = window.LIFESAVER_API_BASE || 'http://localhost:4000';
const TOKEN_KEY='lifesaver_auth_token';
function goLoginIfAuthRequired(json){
  if(json && json.error && json.error.code==='AUTH_REQUIRED'){
    const current=window.location.pathname.split('/').pop()||'index.html';
    if(current!=='login.html') window.location.href='./login.html';
    return true;
  }
  return false;
}
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let energy=0,targetE=0,ripples=[];  /* shared by waveforms + orb + conversation; declared early to avoid TDZ */

/* uptime */
let up=[152,14,27,42];setInterval(()=>{up[3]++;if(up[3]>59){up[3]=0;up[2]++}if(up[2]>59){up[2]=0;up[1]++}if(up[1]>23){up[1]=0;up[0]++}$('uptime').textContent=`${up[0]}D ${up[1]}H ${up[2]}M ${String(up[3]).padStart(2,'0')}S`;},1000);
$('briefDate').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}).toUpperCase();

/* cpu gauge */
setTimeout(()=>{$('cpuArc').style.transition='stroke-dashoffset 1.4s ease';$('cpuArc').style.strokeDashoffset=213.6*(1-0.91);},300);

/* transmissions */
const TR=[['🇺🇸','New order','+$49'],['🇩🇪','Cart recovered','+$86'],['🇯🇵','Returning customer','+$120'],['🇦🇪','New sale','+$299'],['🇦🇺','Order placed','+$49']];
const tb=$('transBox');TR.forEach((t,i)=>{const sec=[12,7,9,15,8][i];tb.insertAdjacentHTML('beforeend',`<div class="trrow"><span class="fl">${t[0]}</span><span class="city">${t[1]}</span><span class="enc">${t[2]}</span><span class="tm" data-s="${sec}">${sec}s ago</span></div>`);});
setInterval(()=>{document.querySelectorAll('.tm').forEach(e=>{let s=+e.dataset.s+1;e.dataset.s=s;e.textContent=s<60?`${s}s ago`:`${(s/60|0)}m ago`;});},1000);

/* generic canvas sizing */
function fit(c){const d=Math.min(devicePixelRatio||1,2);const r=c.getBoundingClientRect();c.width=r.width*d;c.height=r.height*d;const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);return [x,r.width,r.height];}

/* world map dots (region clusters) */
const REGIONS=[[8,22,18,16],[14,46,12,22],[40,16,16,16],[44,40,12,26],[58,18,30,22],[78,52,12,12]]; // x%,y%,w%,h% : NA,SA,EU,AF,ASIA,AUS
function drawMap(id,color){const c=$(id);if(!c)return;const [x,W,H]=fit(c);const dots=[];REGIONS.forEach(([rx,ry,rw,rh])=>{const n=Math.round(rw*rh/22);for(let i=0;i<n;i++)dots.push([(rx+Math.random()*rw)/100*W,(ry+Math.random()*rh)/100*H,Math.random()]);});
  function f(){x.clearRect(0,0,W,H);x.globalCompositeOperation='lighter';
    // faint connection arcs
    x.strokeStyle=color;x.globalAlpha=.18;x.lineWidth=.6;for(let k=0;k<6;k++){const a=dots[(Math.random()*dots.length)|0],b=dots[(Math.random()*dots.length)|0];x.beginPath();x.moveTo(a[0],a[1]);x.quadraticCurveTo((a[0]+b[0])/2,Math.min(a[1],b[1])-18,b[0],b[1]);x.stroke();}
    for(const d of dots){const tw=.4+.6*Math.abs(Math.sin(Date.now()*0.001*(0.4+d[2])+d[0]));x.globalAlpha=.35+tw*.5;x.fillStyle=color;x.fillRect(d[0],d[1],1.6,1.6);}
    x.globalAlpha=1;x.globalCompositeOperation='source-over';if(!reduce)requestAnimationFrame(f);}f();}
drawMap('mapGlobal','#2bb4ff');drawMap('mapAgent','#37e08a');

/* network traffic chart */
function traffic(){const c=$('traffic');const [x,W,H]=fit(c);let series=[[],[],[]],t=0;const cols=['#2bb4ff','#7fdcff','#b388ff'];for(let s=0;s<3;s++)for(let i=0;i<60;i++)series[s].push(Math.random());
  function f(){t+=1;if(t%3===0){series.forEach((s,i)=>{s.push(Math.max(0,Math.min(1,s[s.length-1]+(Math.random()-.5)*.4)));s.shift();});}
    x.clearRect(0,0,W,H);for(let s=2;s>=0;s--){x.beginPath();series[s].forEach((v,i)=>{const px=i/59*W,py=H-v*H*0.9-4;i===0?x.moveTo(px,py):x.lineTo(px,py);});x.lineTo(W,H);x.lineTo(0,H);x.closePath();const grd=x.createLinearGradient(0,0,0,H);grd.addColorStop(0,cols[s]+'55');grd.addColorStop(1,cols[s]+'00');x.fillStyle=grd;x.fill();x.strokeStyle=cols[s];x.lineWidth=1.3;x.beginPath();series[s].forEach((v,i)=>{const px=i/59*W,py=H-v*H*0.9-4;i===0?x.moveTo(px,py):x.lineTo(px,py);});x.stroke();}
    if(!reduce)requestAnimationFrame(f);}f();}
traffic();

/* waveforms */
function waveform(id,amp){const c=$(id);const [x,W,H]=fit(c);let t=0;
  function f(){t+=0.07;x.clearRect(0,0,W,H);x.strokeStyle='#2bb4ff';x.lineWidth=1.6;x.shadowBlur=6;x.shadowColor='#2bb4ff';x.beginPath();for(let px=0;px<=W;px+=2){const e=1+energy*1.4;const y=H/2+Math.sin(px*0.05+t)*amp*e*Math.sin(px*0.013+t*.4)+Math.sin(px*0.14+t*2)*amp*.5*e;px===0?x.moveTo(px,y):x.lineTo(px,y);}x.stroke();x.shadowBlur=0;if(!reduce)requestAnimationFrame(f);}f();}
waveform('waveTop',7);waveform('waveBot',13);

/* ===== central network globe ===== */
const oc=$('orb');let ox=oc.getContext('2d'),OW,OH,ODPR,ocx,ocy,OR,nodes=[],edges=[],ay=0;
function orbResize(){ODPR=Math.min(devicePixelRatio||1,2);const r=oc.getBoundingClientRect();OW=r.width;OH=r.height;oc.width=OW*ODPR;oc.height=OH*ODPR;ox.setTransform(ODPR,0,0,ODPR,0,0);ocx=OW/2;ocy=OH*0.46;OR=Math.min(OW,OH)*0.34;}
function orbBuild(){const N=OW<700?70:104,GA=Math.PI*(3-Math.sqrt(5));nodes=[];for(let i=0;i<N;i++){const y=1-(i/(N-1))*2,r=Math.sqrt(1-y*y),th=i*GA;nodes.push([Math.cos(th)*r,y,Math.sin(th)*r]);}edges=[];for(let i=0;i<N;i++){const da=[];for(let j=0;j<N;j++)if(i!==j){const dx=nodes[i][0]-nodes[j][0],dy=nodes[i][1]-nodes[j][1],dz=nodes[i][2]-nodes[j][2];da.push([dx*dx+dy*dy+dz*dz,j]);}da.sort((a,b)=>a[0]-b[0]);for(let k=0;k<2;k++)if(i<da[k][1])edges.push([i,da[k][1]]);}}
orbResize();orbBuild();
function rot(p,cy_,sy_,cx_,sx_){let x=p[0],y=p[1],z=p[2];let x1=x*cy_+z*sy_,z1=-x*sy_+z*cy_;let y2=y*cx_-z1*sx_,z2=y*sx_+z1*cx_;return [x1,y2,z2];}
function orbFrame(){
  energy+=(targetE-energy)*0.06;ay+=0.0024*(1+energy*2);
  const cY=Math.cos(ay),sY=Math.sin(ay),cX=Math.cos(0.45),sX=Math.sin(0.45),ex=1+energy*0.1;
  ox.clearRect(0,0,OW,OH);ox.globalCompositeOperation='lighter';
  // aura
  let ag=ox.createRadialGradient(ocx,ocy,0,ocx,ocy,OR*2.4);ag.addColorStop(0,`rgba(43,150,255,${0.12+energy*0.15})`);ag.addColorStop(.5,'rgba(30,90,200,.05)');ag.addColorStop(1,'rgba(0,0,0,0)');ox.fillStyle=ag;ox.beginPath();ox.arc(ocx,ocy,OR*2.4,0,7);ox.fill();
  // orbital rings
  for(let o=0;o<3;o++){const tilt=0.5+o*0.5,rr=OR*(1.35+o*0.16),ph=ay*(0.5- o*0.12);ox.globalAlpha=.4;ox.strokeStyle='#2bb4ff';ox.lineWidth=1.1;ox.beginPath();for(let a=0;a<=6.3;a+=0.1){const x=Math.cos(a)*rr,y=Math.sin(a)*rr*0.32;const xr=x*Math.cos(ph)-y*Math.sin(ph),yr=(x*Math.sin(ph)+y*Math.cos(ph))*Math.cos(tilt);a===0?ox.moveTo(ocx+xr,ocy+yr):ox.lineTo(ocx+xr,ocy+yr);}ox.stroke();
    const ea=ay*1.5+o;const ex2=Math.cos(ea)*rr,ey2=Math.sin(ea)*rr*0.32;const exr=ex2*Math.cos(ph)-ey2*Math.sin(ph),eyr=(ex2*Math.sin(ph)+ey2*Math.cos(ph))*Math.cos(tilt);ox.globalAlpha=1;ox.fillStyle='#bfeaff';ox.beginPath();ox.arc(ocx+exr,ocy+eyr,2.4,0,7);ox.fill();}
  // project nodes
  const P=nodes.map(n=>{const r=rot(n,cY,sY,cX,sX);const persp=1.7/(1.7-r[2]*0.5);return [ocx+r[0]*OR*ex*persp,ocy+r[1]*OR*ex*persp,(r[2]+1)/2];});
  // edges
  for(const [a,b] of edges){const d=(P[a][2]+P[b][2])/2;ox.globalAlpha=0.08+d*0.32;ox.strokeStyle=d>0.6?'#7fdcff':'#1e6fd0';ox.lineWidth=0.7;ox.beginPath();ox.moveTo(P[a][0],P[a][1]);ox.lineTo(P[b][0],P[b][1]);ox.stroke();}
  // nodes
  for(const p of P){ox.globalAlpha=0.25+p[2]*0.75;ox.fillStyle=p[2]>0.7?'#eaffff':'#2bb4ff';ox.beginPath();ox.arc(p[0],p[1],(0.8+p[2]*2),0,7);ox.fill();}
  // core
  const cr=OR*(0.4+0.05*Math.sin(ay*3))+energy*OR*0.25;let cg=ox.createRadialGradient(ocx,ocy,0,ocx,ocy,cr);cg.addColorStop(0,`rgba(255,255,255,${0.5+energy*0.4})`);cg.addColorStop(.35,'rgba(127,220,255,.35)');cg.addColorStop(1,'rgba(43,150,255,0)');ox.globalAlpha=1;ox.fillStyle=cg;ox.beginPath();ox.arc(ocx,ocy,cr,0,7);ox.fill();
  // dais
  const fy=ocy+OR*1.5;for(let i=0;i<4;i++){const ph=(ay*0.3+i/4)%1,rr=OR*0.3+ph*OR*1.1;ox.globalAlpha=(1-ph)*0.4;ox.strokeStyle='#2bb4ff';ox.lineWidth=1.4;ox.beginPath();ox.ellipse(ocx,fy,rr,rr*0.16,0,0,7);ox.stroke();}
  // ripples
  for(let i=ripples.length-1;i>=0;i--){const rp=ripples[i];rp.r+=2.4+energy*2;rp.a*=0.97;if(rp.a<.02){ripples.splice(i,1);continue;}ox.globalAlpha=rp.a;ox.strokeStyle='#7fdcff';ox.lineWidth=1.3;ox.beginPath();ox.arc(ocx,ocy,rp.r,0,7);ox.stroke();}
  ox.globalAlpha=1;ox.globalCompositeOperation='source-over';if(!reduce)requestAnimationFrame(orbFrame);
}
orbFrame();
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{orbResize();orbBuild();},160);});

/* ===== conversation ===== */
const PERSONA=`You are LIFE.SAVER, but you speak in the manner of a refined British AI butler — impeccably polite, unflappable, quietly witty with dry understatement, and always a step ahead. Address the operator as "sir". You advise on their DTC/ecommerce business using verified revenue, orders, AOV, ad spend, ROAS, conversion rate, and attribution data when available. Calm, precise, faintly amused, gracious but never grovelling. Replies SHORT: 1-3 sentences unless asked to expand. Reference real figures (revenue, customers, campaigns, content) naturally. Never mention being an AI, a language model, prompts, or internal mechanics. No emojis. Do not quote any film dialogue verbatim.`;
let history=[];
/* ===== voice (browser text-to-speech) ===== */
let voiceOn=true,pickedVoice=null;
function loadVoices(){if(!('speechSynthesis'in window))return;const vs=speechSynthesis.getVoices();if(!vs||!vs.length)return;pickedVoice=vs.find(v=>/en-GB/i.test(v.lang)&&/male|daniel|arthur|george|uk english male/i.test(v.name))||vs.find(v=>/en-GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||vs[0];}
if('speechSynthesis'in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices;}
function speak(t){if(!voiceOn||!('speechSynthesis'in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);if(pickedVoice)u.voice=pickedVoice;u.lang=(pickedVoice&&pickedVoice.lang)||'en-GB';u.rate=0.98;u.pitch=0.9;speechSynthesis.speak(u);}catch(e){}}
const vt=$('voiceToggle');if(vt)vt.addEventListener('click',()=>{voiceOn=!voiceOn;const st=$('voiceState');st.textContent=voiceOn?'ACTIVE':'MUTED';st.style.color=voiceOn?'var(--green)':'var(--dim)';if(!voiceOn&&'speechSynthesis'in window)speechSynthesis.cancel();});
function typeOut(t){const out=$('out'),cur=$('cur');out.textContent="";cur.style.display='inline-block';ripples.push({r:OR*0.5,a:.6});let i=0;const id=setInterval(()=>{out.textContent+=t[i++]||"";if(i%3===0&&Math.random()<.4)ripples.push({r:OR*0.5,a:.3});if(i>=t.length){clearInterval(id);targetE=0;$('sysstat').textContent='ACTIVE';setTimeout(()=>cur.style.display='none',500);}},18);}
function localReply(q){q=(q||'').toLowerCase();const pick=a=>a[(Math.random()*a.length)|0];
  const m=latestMetricsCache; const live=m&&isCoreLive(m); const core=live?`${money(m.revenue)} revenue, ${m.orders} orders, ${money(m.adSpend)} paid-media spend, and ${roasText(m.roas)} blended ROAS`:'verified Triple Whale core metrics once the connector is refreshed';
  if(/hello|hi|hey|morning|good day|yo/.test(q))return pick(["Good day, sir. Everything is running precisely as it should. How may I be of service?","At your service, sir. The business is in fine order this morning."]);
  if(/revenue|money|sales|making|earn|profit/.test(q))return live ? `Certainly, sir. Current verified core revenue is ${money(m.revenue)} from ${m.orders} orders, with ${roasText(m.roas)} blended ROAS.` : "Certainly, sir. I shall use verified Triple Whale core figures once the connector is refreshed; no demo revenue will be treated as live.";
  if(/post|content|video|tiktok|instagram|youtube|reel|caption/.test(q))return "Certainly, sir. I can prepare content drafts for review, but v1 will not publish anything automatically. Founder approval remains the final gate.";
  if(/\bads?\b|campaign|meta|google|spend|roas|budget/.test(q))return live ? `Quite right to check, sir. Paid-media spend is currently ${money(m.adSpend)} with ${roasText(m.roas)} blended ROAS. I shall advise only; v1 will not adjust budgets.` : "Quite right to check, sir. I shall advise only once verified paid-media spend is available; v1 will not adjust budgets.";
  if(/support|ticket|customer|refund|complain/.test(q))return "Certainly, sir. I can draft a careful support reply for approval, but I shall not send it automatically in v1.";
  if(/status|how are|how's|how is|doing|report|update|brief|today/.test(q))return live ? `Certainly, sir. Verified Triple Whale core metrics show ${core}. We remain safely in advisory mode.` : "Certainly, sir. We are safely in advisory mode and awaiting verified Triple Whale core metrics.";
  if(/cancel|leaving|retention|refund/.test(q))return "Understood, sir. I can analyse retention or refund signals once Triple Whale data is available, and I may draft a reply, but no customer message will be sent automatically.";
  return pick(["At your service, sir. I can advise, analyse, and draft safely; any real-world action remains yours to approve.","Very good, sir. I shall keep this in advisory mode and avoid making any external change.","An excellent instinct, sir. I can prepare a recommendation from verified data once the live connector is in place."]);
}
async function ask(q){targetE=0.9;$('ihead').textContent='PROCESSING';$('sysstat').textContent='PROCESSING';$('out').textContent="";$('cur').style.display='inline-block';history.push({role:"user",content:q});
  let t="";
  let chatPayload=null;
  try{
    const token=localStorage.getItem(TOKEN_KEY)||'';
    const headers={"Content-Type":"application/json"};
    if(token) headers.Authorization=`Bearer ${token}`;
    const res=await fetch(`${API_BASE}/api/v1/chat`,{method:"POST",headers,body:JSON.stringify({message:q,history:history.map(h=>({role:h.role,content:h.content}))})});
    const data=await res.json();
    chatPayload=data&&data.success&&data.data?data.data:null;
    if(chatPayload&&chatPayload.mode==='claude_live'){$('ihead').textContent=chatPayload.toolMode==='safe_tools_executed'?'CLAUDE TOOLS':'CLAUDE LINK';}
    if(chatPayload&&chatPayload.draftSaved){setDraftStatusMessage(`Saved as ${chatPayload.draftSaved.draftType.replace('_',' ')} draft for approval.`, 'success');}
    if(chatPayload&&chatPayload.toolCalls&&chatPayload.toolCalls.length){
      const names=chatPayload.toolCalls.map(t=>t.name).join(', ');
      setDraftStatusMessage(`Safe Claude tool call completed: ${names}. No external action was taken.`, 'success');
    }
    t=(chatPayload&&chatPayload.reply)?chatPayload.reply:"";
  }catch(e){t="";}
  if(!t)t=localReply(q);
  history.push({role:"assistant",content:t});targetE=1;if(!['CLAUDE LINK','CLAUDE TOOLS'].includes($('ihead').textContent))$('ihead').textContent='TRANSMISSION';speak(t);typeOut(t);
  if(chatPayload&&chatPayload.draftSaved){loadDrafts();}
  $('send').disabled=false;}
function submit(){const q=$('inp').value.trim();if(!q)return;$('inp').value="";$('send').disabled=true;ask(q);}
$('send').addEventListener('click',submit);$('inp').addEventListener('keydown',e=>{if(e.key==='Enter')submit();});

/* ===== backend metrics loader ===== */
let latestMetricsCache = null;
function money(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v||0));}
function money2(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));}
function percent(v){return `${Number(v||0).toFixed(1)}%`;}
function roasText(v){return `${Number(v||0).toFixed(2)}x`;}
function isCoreLive(m){return Boolean(m && (m.coreMetricsProductionReady || m.productionReady || String(m.sourceStatus||'').includes('core_metrics_ready')));}
function hasPlatformConversion(m){return Boolean(m && m.platformConversionProductionReady && Number(m.platformConversionValue||0)>0);}
function platformConversionText(m){return hasPlatformConversion(m) ? money(m.platformConversionValue) : 'Awaiting Data';}
function platformConversionSourceText(m){return (m && Array.isArray(m.platformConversionSources) && m.platformConversionSources.length) ? m.platformConversionSources.join(' + ') : 'awaiting active platform data';}
function conversionText(m){
  if(m && m.conversionRateProductionReady && Number(m.conversionRate||0)>0) return percent(m.conversionRate);
  if(m && (Number(m.conversionRate||0)===0 || String(m.conversionRateStatus||'').includes('pending') || String(m.conversionRateStatus||'').includes('awaiting'))) return 'Awaiting Sessions';
  return 'Needs Mapping';
}
function setText(id, value){const el=$(id); if(el) el.textContent = value;}
function setHtml(id, value){const el=$(id); if(el) el.innerHTML = value;}

function applyMetricsToDashboard(m){
  if(!m) return;
  latestMetricsCache = m;
  const liveCore = isCoreLive(m);
  const revenue = money(m.revenue);
  const orders = String(m.orders || 0);
  const aov = money2(m.aov);
  const adSpend = money(m.adSpend);
  const roas = roasText(m.roas);
  const conversion = conversionText(m);
  const platformReady = hasPlatformConversion(m);
  const platformValue = platformConversionText(m);
  const platformSources = platformConversionSourceText(m);

  setText('metricRevenue', revenue);
  setText('metricOrders', orders);
  setText('metricAov', aov);
  setText('metricAdSpend', adSpend);
  setText('metricRoas', roas);
  setText('metricConversionRate', conversion);

  setText('metricStreamRevenue', revenue);
  setText('metricStreamAdSpend', adSpend);
  setText('metricStreamAttribution', platformValue);

  setText('adIntelligenceStatus', liveCore ? 'CORE' : 'DEMO');
  setText('adImpressions', '—');
  setText('adConversions', '—');

  setText('weeklyRevenue', revenue);
  setText('weeklyOrders', orders);
  setText('weeklyAov', aov);
  setText('weeklyRoas', roas);
  setText('weeklyAdSpend', `${adSpend} spend`);
  setText('weeklyConversion', conversion);
  setText('weeklyRevenueSub', liveCore ? 'verified Triple Whale' : 'not production ready');
  setText('weeklyOrdersSub', liveCore ? 'confirmed core metric' : 'awaiting live core metrics');
  setText('weeklyConversionSub', m.conversionRateProductionReady ? (String(m.conversionRateStatus||'').includes('calculated_from_orders_sessions') ? 'orders ÷ sessions' : 'confirmed conversion rate') : 'needs sessions/reach mapping');
  setText('weeklyMode', liveCore ? 'LIVE' : 'SAFE');
  setText('weeklyModeSub', liveCore ? 'verified core metrics' : 'read · advise · draft');

  if(liveCore){
    setHtml('dailyBriefText', `Good morning. Verified Triple Whale core metrics show <b>${revenue}</b> revenue, <b>${orders}</b> orders, <b>${adSpend}</b> paid-media spend, and <b>${roas}</b> blended ROAS.${platformReady ? ` Active platform conversion value is <b>${platformValue}</b> from <b>${platformSources}</b>.` : ' Active platform conversion value is awaiting non-zero platform data.'} Conversion rate is ${conversion === 'Awaiting Sessions' ? 'awaiting sessions/visitor data' : 'still pending confirmed mapping'}.`);
    setHtml('weeklySummaryNote', `<b style="color:var(--blueb)">Summary:</b> Verified Triple Whale core metrics are live. Revenue, orders, AOV, paid-media spend, and blended ROAS are sourced from the latest stored Summary snapshot.${platformReady ? ` Platform conversion value is ${platformValue} from ${platformSources}; inactive zero-value platforms are ignored and will auto-include later.` : ' Platform conversion value is awaiting active source data.'} Conversion rate remains ${conversion === 'Awaiting Sessions' ? 'awaiting sessions/visitor data' : 'separately confirmed before reach is calculated'}.`);
  }else{
    setHtml('dailyBriefText', 'Good morning. LIFE.SAVER is still showing non-production or fallback metrics. Please run Triple Whale Summary probe and confirm core mapping before treating figures as final.');
    setHtml('weeklySummaryNote', `<b style="color:var(--amber)">Status:</b> Dashboard is not using production-ready core metrics yet. Any demo/static module is labelled separately.`);
  }
}

async function loadDashboardMetrics(){
  try{
    const res=await fetch(`${API_BASE}/api/v1/metrics`,{headers:authHeaders()});
    const json=await res.json();
    if(goLoginIfAuthRequired(json)) return;
    if(!json.success || !json.data) return;
    applyMetricsToDashboard(json.data);
  }catch(e){
    console.warn('LIFE.SAVER metrics API not available yet. Showing fallback dashboard values.');
  }
}

/* ===== brief + weekly loaders ===== */
async function loadDailyBrief(){
  try{
    const res=await fetch(`${API_BASE}/api/v1/brief`,{headers:authHeaders()});
    const json=await res.json();
    if(goLoginIfAuthRequired(json)) return;
    if(!json.success || !json.data) return;
    const b=json.data;
    if(!b.productionReady && latestMetricsCache && isCoreLive(latestMetricsCache)) return;
    if($('dailyBriefText')) $('dailyBriefText').innerHTML=b.content;
  }catch(e){
    console.warn('LIFE.SAVER brief API not available yet. Showing fallback brief.');
  }
}

async function loadWeeklySummary(){
  try{
    const res=await fetch(`${API_BASE}/api/v1/weekly`,{headers:authHeaders()});
    const json=await res.json();
    if(goLoginIfAuthRequired(json)) return;
    if(!json.success || !json.data) return;
    const w=json.data;
    if(!w.productionReady && latestMetricsCache && isCoreLive(latestMetricsCache)) return;
    if(w.metrics) applyMetricsToDashboard({ ...(latestMetricsCache||{}), ...w.metrics, productionReady: w.productionReady, sourceStatus: w.sourceStatus });
    if($('weeklySummaryNote')) $('weeklySummaryNote').innerHTML=`<b style="color:var(--blueb)">Summary:</b> ${w.content}`;
  }catch(e){
    console.warn('LIFE.SAVER weekly API not available yet. Showing fallback weekly summary.');
  }
}


/* ===== Drafts UI + Review Panel (v0.5.2) ===== */
let latestDraftsCache=[];
function authHeaders(){
  const token=localStorage.getItem(TOKEN_KEY)||'';
  return token?{Authorization:`Bearer ${token}`}:{};
}
function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function shortText(value, max=170){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length>max?`${text.slice(0,max-1)}…`:text;
}
function draftLabel(type){
  return String(type||'draft').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
}
function statusClass(status){
  if(status==='approved') return 'green';
  if(status==='rejected') return 'danger-text';
  return 'amber';
}
function setDraftStatusMessage(text, kind=''){
  const el=$('draftReviewStatus');
  if(!el) return;
  el.textContent=kind==='success'?'UPDATED':(kind==='error'?'ERROR':'READY');
  el.className=kind==='error'?'tag danger-tag':(kind==='success'?'tag':'tag amber-tag');
  const note=document.querySelector('.draft-safe-note');
  if(note&&text) note.textContent=text;
}
function updateDraftCounts(drafts){
  const total=drafts.length;
  const draft=drafts.filter(d=>d.status==='draft').length;
  const approved=drafts.filter(d=>d.status==='approved').length;
  const rejected=drafts.filter(d=>d.status==='rejected').length;
  setText('draftCountTotal', String(total));
  setText('draftCountDraft', String(draft));
  setText('draftCountApproved', String(approved));
  setText('draftCountRejected', String(rejected));
}
function renderDrafts(drafts){
  latestDraftsCache=drafts||[];
  updateDraftCounts(latestDraftsCache);
  const box=$('draftReviewList');
  if(!box) return;
  if(!latestDraftsCache.length){
    box.innerHTML='<div class="draft-empty">No saved drafts yet. Ask LIFE.SAVER to draft a post, script, or support reply, or use the quick draft buttons.</div>';
    setDraftStatusMessage('No drafts yet. Drafts will appear here for founder review only.');
    return;
  }
  setDraftStatusMessage('Draft review panel loaded. Status changes do not send or publish anything.', 'success');
  box.innerHTML=latestDraftsCache.slice(0,8).map(d=>{
    const created=d.createdAt?new Date(d.createdAt).toLocaleString():'—';
    const content=escapeHtml(shortText(d.content,230));
    const prompt=escapeHtml(shortText(d.prompt,120));
    const status=escapeHtml(d.status||'draft');
    return `<article class="draft-card" data-draft-id="${escapeHtml(d.id)}">
      <div class="draft-card-head">
        <div><strong>${escapeHtml(draftLabel(d.draftType))}</strong><small>${created}</small></div>
        <span class="draft-status ${statusClass(d.status)}">${status.toUpperCase()}</span>
      </div>
      <div class="draft-prompt">${prompt}</div>
      <div class="draft-content">${content}</div>
      <div class="draft-card-actions">
        <button class="mini-btn ghost" data-copy-draft="${escapeHtml(d.id)}">Copy</button>
        <button class="mini-btn" data-status-draft="${escapeHtml(d.id)}" data-status="approved">Approve</button>
        <button class="mini-btn ghost" data-status-draft="${escapeHtml(d.id)}" data-status="rejected">Reject</button>
        <button class="mini-btn ghost" data-status-draft="${escapeHtml(d.id)}" data-status="draft">Back to Draft</button>
      </div>
    </article>`;
  }).join('');
}
async function loadDrafts(){
  const box=$('draftReviewList');
  if(box) box.innerHTML='<div class="draft-empty">Loading saved drafts…</div>';
  try{
    const res=await fetch(`${API_BASE}/api/v1/drafts`,{headers:authHeaders()});
    if(res.status===401){renderDrafts([]);setDraftStatusMessage('Please log in to load saved drafts.', 'error');return;}
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to load drafts.');
    renderDrafts(json.data.drafts||[]);
  }catch(error){
    if(box) box.innerHTML=`<div class="draft-empty">${escapeHtml(error.message||'Unable to load drafts.')}</div>`;
    setDraftStatusMessage(error.message||'Unable to load drafts.', 'error');
  }
}
async function updateDraftStatus(draftId,status){
  if(status==='approved'){
    const ok=window.confirm('Approve only marks this draft as approved inside LIFE.SAVER. It will NOT publish, send, refund, or change any external platform in V1. Continue?');
    if(!ok) return;
  }
  setDraftStatusMessage(`Updating draft status to ${status}…`);
  try{
    const res=await fetch(`${API_BASE}/api/v1/drafts/${encodeURIComponent(draftId)}/status`,{
      method:'PATCH',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({status})
    });
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to update draft status.');
    setDraftStatusMessage(`Draft marked ${status}. No external action was taken.`, 'success');
    await loadDrafts();
  }catch(error){setDraftStatusMessage(error.message||'Unable to update draft status.', 'error');}
}
async function copyDraft(draftId){
  const draft=latestDraftsCache.find(d=>d.id===draftId);
  if(!draft) return;
  try{
    await navigator.clipboard.writeText(draft.content||'');
    setDraftStatusMessage('Draft copied to clipboard. Review before using externally.', 'success');
  }catch(_error){
    setDraftStatusMessage('Unable to copy automatically. Open the draft and copy manually.', 'error');
  }
}
async function createQuickDraft(type){
  const isSupport=type==='support_reply';
  const prompt=window.prompt(isSupport?'Paste the customer issue/ticket for a suggested reply:':'What content should LIFE.SAVER draft?');
  if(!prompt||!prompt.trim()) return;
  const button=isSupport?$('newSupportDraftBtn'):$('newContentDraftBtn');
  if(button){button.disabled=true;button.textContent=isSupport?'Drafting Reply…':'Drafting Content…';}
  setDraftStatusMessage('Generating a draft for founder approval only…');
  try{
    const endpoint=isSupport?'/api/v1/drafts/support-reply':'/api/v1/drafts/content';
    const body=isSupport?{ticket:prompt,customerName:'Customer',issueType:'general support'}:{prompt,channel:'social/content',tone:'calm, premium, founder-approved'};
    const res=await fetch(`${API_BASE}${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(body)});
    const json=await res.json();
    if(!res.ok||!json.success) throw new Error(json.error?.message||'Unable to create draft.');
    setDraftStatusMessage('Draft created and saved. No external action was taken.', 'success');
    await loadDrafts();
  }catch(error){setDraftStatusMessage(error.message||'Unable to create draft.', 'error');}
  finally{if(button){button.disabled=false;button.textContent=isSupport?'New Support Reply':'New Content Draft';}}
}

const draftReviewList=$('draftReviewList');
if(draftReviewList){
  draftReviewList.addEventListener('click', event=>{
    const target=event.target;
    if(!(target instanceof HTMLElement)) return;
    const copyId=target.getAttribute('data-copy-draft');
    if(copyId) copyDraft(copyId);
    const statusId=target.getAttribute('data-status-draft');
    const status=target.getAttribute('data-status');
    if(statusId&&status) updateDraftStatus(statusId,status);
  });
}
const refreshDraftsBtn=$('refreshDraftsBtn'); if(refreshDraftsBtn) refreshDraftsBtn.addEventListener('click', loadDrafts);
const newContentDraftBtn=$('newContentDraftBtn'); if(newContentDraftBtn) newContentDraftBtn.addEventListener('click',()=>createQuickDraft('content'));
const newSupportDraftBtn=$('newSupportDraftBtn'); if(newSupportDraftBtn) newSupportDraftBtn.addEventListener('click',()=>createQuickDraft('support_reply'));
const focusDraftsTab=$('focusDraftsTab'); if(focusDraftsTab) focusDraftsTab.addEventListener('click',()=>{const el=$('draftReviewList'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'});});

(async function initLiveDashboard(){
  await loadDashboardMetrics();
  await loadDailyBrief();
  await loadWeeklySummary();
  await loadDrafts();
})();
