// Compile only the explicit AND/button/toggle subset of Logix 0007.
// JMRI 5.8 ALL_AND evaluates every listed variable; the saved antecedent text
// is only authoritative for MIXED, so its stale R-numbers are not executed.
export function compileManualPolicies(source, {turnouts,blocks,coupled,protection,yardBoundaries={},yardTurnouts=[]}) {
  const rules=[],byTurnout={}, nxIds=new Set(source.nxPairs.map(n=>n.id));
  const enabled=source.groups.find(g=>g.id==='IX:AUTO:0007')?.enabled===true;
  for(const rule of source.rules.filter(r=>r.id.startsWith('IX:AUTO:0007'))) {
    const buttons=rule.variables.filter(v=>v.type==='1'&&v.systemName.startsWith('vxv'));
    if(buttons.length!==1) continue;
    const button=buttons[0].systemName, names=button.slice(3).split('/').map(n=>'Vx'+n);
    const action=rule.actions[0], problems=[],freeSensors=rule.variables.filter(v=>v.type==='2').map(v=>v.systemName);
    const inactiveNX=rule.variables.filter(v=>v.type==='36').map(v=>v.systemName);
    if(!enabled) problems.push('Manövergruppen är avstängd eller saknas i källan.');
    if(rule.attributes.logicType!=='1' || rule.actions.length!==1 || action?.type!=='2' || action.data!=='8' || action.option!=='1' || action.delay!=='0' || action.systemName!==names[0] || rule.variables.some(v=>v.negated!=='no'||!['1','2','36'].includes(v.type)||(v.type==='1'&&v!==buttons[0]))) problems.push('Källregelns villkor eller åtgärd stöds inte entydigt.');
    const actual=coupled[action?.systemName]||[];
    if(names.some(n=>!turnouts[n]) || [...names].sort().join('|')!==[...actual].sort().join('|')) problems.push('Knappgruppens fullständiga växelkoppling är inte verifierad i XML-layouten.');
    const requiredBlocks=new Set(names.map(n=>turnouts[n]?.block).filter(Boolean));
    for(const sensor of freeSensors) {
      // The new kernel's owner reservation replaces the old JMRI handover
      // condition. Never wait for or manufacture the old script's sensor.
      if(sensor==='rsAckRangeFri'&&names.every(n=>yardTurnouts.includes(n)))continue;
      const matching=Object.entries(blocks).filter(([,b])=>b.sourceSensor===sensor).map(([n])=>n);
      if(!matching.length) problems.push(sensor==='rsAckRangeFri'?'Rangeröverlämningen är ännu inte ansluten; manuell omläggning är spärrad.':`Villkoret ${sensor} saknar verifierad återrapport eller ersättningsfunktion.`);
      matching.forEach(n=>requiredBlocks.add(n));
    }
    if(inactiveNX.some(id=>!nxIds.has(id))) problems.push('En tågvägsreferens saknas i källans NX-register.');
    const addresses=new Set([...requiredBlocks].map(n=>blocks[n]?.address));
    const signals=Object.entries(protection).filter(([,p])=>p.alternatives.some(a=>a.blocks.some(n=>addresses.has(blocks[n]?.address)) || Object.keys(a.turnouts).some(n=>names.includes(n)))).map(([n])=>n);
    const policy={rule:rule.id,button,names,freeSensors,blocks:[...requiredBlocks].sort(),inactiveNX,signals:signals.sort(),status:problems.length?'unresolved':'ready',reason:problems.join(' ')};
    rules.push(policy);
    for(const name of names) {
      if(byTurnout[name]) throw Error('Conflicting manual source rules: '+name);
      byTurnout[name]=policy;
    }
  }
  for(const name of Object.keys(turnouts)) if(!byTurnout[name]) byTurnout[name]={names:coupled[name]||[name],status:'unresolved',reason:'Ingen entydig manöverregel är ansluten för växeln.'};
  const boundaryOverrides={};
  for(const [name,boundary] of Object.entries(yardBoundaries)) {
    const original=byTurnout[name];
    if(original?.button!==boundary.sourceButton||coupled[name]?.length!==1)throw Error('Rangergränsens manuella källvillkor har ändrats: '+name);
    // A boundary with its own ready single-turnout button (103, 164) keeps that rule.
    if(original.status==='ready'&&original.names.length===1)continue;
    // Replace only the unresolved grouped button, retaining ALL its detector,
    // signal, NX and peer-turnout guards. Do not guess a mechanical coupling.
    if(original.reason!=='Knappgruppens fullständiga växelkoppling är inte verifierad i XML-layouten.')throw Error('Rangergränsens manuella källvillkor har ändrats: '+name);
    const replacement={...original,names:[name],guardTurnouts:original.names,status:'ready',reason:'',reviewedBoundary:true};
    byTurnout[name]=replacement;boundaryOverrides[name]=replacement;
  }
  return {rules,byTurnout,...(Object.keys(boundaryOverrides).length?{boundaryOverrides}:{})};
}
