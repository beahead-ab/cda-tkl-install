const imageUrl=file=>'/assets/mod59/reference-icons/'+encodeURIComponent(file);
const decoded=new Map();
export async function preloadSignalReferences(catalog) {
  await Promise.allSettled(catalog.images.map(async image=>{
    if(decoded.has(image.file))return;
    const element=new Image();element.src=imageUrl(image.file);
    try{await element.decode();decoded.set(image.file,element);}catch{decoded.set(image.file,null);}
  }));
}
export function signalLiveView(name,config,state,online) {
  const binding=config.signals[name],signal=state?.signals?.[name];
  const fresh=!!(online&&state?.connection==='connected'&&signal?.updatedAt>0&&state.serverTime-signal.updatedAt<=config.staleMs);
  return {report:fresh?({go:'Kör återrapporterat',stop:'Stopp återrapporterat'}[signal.aspect]||'Okänt besked'):'Okänt besked',
    permission:fresh?({GO:'Kör begärt',STOP:'Stopp begärt'}[signal.desired]||'—'):'—',
    raw:fresh&&signal.aspect!=='unknown'&&signal.code!=null?String(signal.code):'—',address:binding?.virtual?'Virtuell, bara i panelen':binding?String(binding.reportAddress??binding.address)+((binding.reportKind||config.signalReport?.kind)==='switch'?' (B1)':' (E4)'):'Ej inkopplad'};
}
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
function sourceLink(text,key,openRecord){const b=el('button',text,'signal-source-link');b.type='button';b.onclick=()=>openRecord(key);return b;}
function disclosure(title){const d=el('details',null,'signal-reference-section');d.append(el('summary',title));return d;}
export function createSignalDetails(mast,{config,openRecord}) {
  const root=el('section',null,'signal-reference');root.setAttribute('aria-label','Signalbesked och kopplingar');
  const live=el('div',null,'signal-live');live.append(el('h3','Återrapport i provanläggningen'));
  const values={};const dl=el('dl');
  for(const [key,label] of [['report','Rapporterat'],['permission','Begärt'],['raw','Råkod'],['address','Provadress']]){dl.append(el('dt',label));values[key]=el('dd','—');dl.append(values[key]);}
  live.append(dl,el('p','Fullständigt svenskt MGP-besked är ännu inte verifierat.','muted'));root.append(live);
  root.append(el('h3','Besked i källunderlaget'));
  root.append(el('p',mast.virtual?'Virtuell signal i XML. Bilder och beskedsnamn nedan kommer från den matchande typdefinitionen; någon fysisk utgång är inte angiven.':`${mast.aspects.length} aspektbindningar · ${mast.type}`,'muted'));
  if(mast.definitionStatus==='missing')root.append(el('p','Exakt bilddefinition för '+mast.type+' saknas i det verifierade underlaget. Källans besked och utgångar visas nedan.','signal-source-notice'));
  root.append(el('p','Referensbilderna visar källans utseende. Aktuellt rapporterat läge visas ovan.','muted'));
  const wrap=el('div',null,'table-wrap'),table=el('table',null,'signal-aspect-table'),thead=el('thead'),headers=el('tr');
  for(const text of ['Bild','Besked','Utgång i XML'])headers.append(el('th',text));thead.append(headers);table.append(thead);
  const body=el('tbody');
  for(const aspect of mast.aspects) {
    const row=el('tr'),picture=el('td'),name=el('td'),output=el('td');
    if(aspect.image&&decoded.get(aspect.image.file)) {
      const img=el('img');img.src=imageUrl(aspect.image.file);img.width=aspect.image.width;img.height=aspect.image.height;img.alt='Referensbild för '+aspect.name;picture.append(img);
    }else{picture.append(el('span','—'));picture.title=aspect.image?'Bildfilen kunde inte läsas':'Exakt bilddefinition saknas';}
    name.append(el('strong',aspect.name));
    if(!aspect.image)name.append(el('small','Bild ej verifierad','muted'));
    if(aspect.origin==='type-definition')name.append(el('small','Typdefinition','muted'));
    if(aspect.outputStatus==='linked') {
      output.append(sourceLink(aspect.turnoutRef+' · '+aspect.turnoutSystem,aspect.turnoutKey,openRecord));
      output.append(el('small','Utgångsläge: '+aspect.turnoutState,'muted'));
      if(aspect.sameCommandAspects.length) {
        const shared=disclosure('Delar order med '+aspect.sameCommandAspects.length+' andra besked');
        shared.append(el('p',aspect.sameCommandAspects.join(', ')));output.append(shared);
      }
    }else output.append(el('span',({missing:'Utgång saknas i XML',virtual:'Virtuell · ingen utgång',unresolved:'Referensen kan inte lösas'}[aspect.outputStatus]),'signal-source-notice'));
    row.append(picture,name,output);body.append(row);
  }
  table.append(body);wrap.append(table);root.append(wrap);
  const relationCount=mast.outgoing.length+mast.incoming.length,relations=disclosure('Signalrelationer ('+relationCount+')');
  relations.append(el('p','Importerade samband. Deras fullständiga villkor öppnas i källregistret.','muted'));
  for(const relation of [...mast.outgoing,...mast.incoming]) relations.append(sourceLink(relation.from+' → '+relation.to+(relation.enabled==='no'?' · avstängd i XML':''),relation.sourceKey,openRecord));
  if(!relationCount)relations.append(el('p','Inga signalrelationer är angivna.','muted'));root.append(relations);
  const rules=disclosure('Regler som berör signalen eller dess utgångar ('+mast.rules.length+')');
  for(const rule of mast.rules)rules.append(sourceLink(rule.name+' · '+rule.id,rule.sourceKey,openRecord));root.append(rules);
  const placements=disclosure('Placering och bildkälla');
  for(const icon of mast.icons)placements.append(sourceLink(`${icon.imageset} · (${icon.x}, ${icon.y}) · ${icon.degrees}° · skala ${icon.scale}`,icon.sourceKey,openRecord));
  root.append(placements);
  return {element:root,update(state,online){const next=signalLiveView(mast.name,config,state,online);for(const key of Object.keys(values))values[key].textContent=next[key];}};
}
