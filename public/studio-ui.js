// Små byggstenar som Studios vyer delar: escapning, uppslag och de enkla komponenterna.
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const $=(s,r=document)=>r.querySelector(s);
export const mono=s=>`<span class="mono">${esc(s)}</span>`;
export const pill=(t,k='',dashed=false)=>`<span class="st-pill${k?' st-pill-'+k:''}${dashed?' st-pill-dashed':''}">${esc(t)}</span>`;
export const kv=rows=>`<dl class="st-kv">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
export const card=(title,body,{right='',foot='',id=''}={})=>`<section class="st-card"${id?` id="${id}"`:''}><div class="st-card-head"><h2>${title}</h2><span class="st-grow"></span>${right}</div>${body}${foot?`<div class="st-card-foot">${foot}</div>`:''}</section>`;
export const fmt=t=>t?new Date(t).toLocaleString('sv-SE'):'–';
export const stamp=n=>new Date(n).toLocaleTimeString('sv-SE',{hour12:false})+'.'+String(n%1000).padStart(3,'0');
// Mätstatus för ett objekt ur registret: fält räknas för drift, simulatorn är bänk.
export function measuredPill(o,fallback='Ej uppmätt'){
  const m=o?.measured;if(!m)return pill(fallback,'amber');
  const field=m.mode==='hardware';return pill(`Uppmätt ${field?'i fält':'i simulatorn'} · ${new Date(m.at).toLocaleDateString('sv-SE')} · ${m.by}`,field?'':'amber',!field);
}
