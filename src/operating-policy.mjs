// Reviewed replacements for source Logix 0023 and 0025. Source names remain
// identities; scripts are not executed and reports are never fabricated here.
export function compileOperatingControls(source, panel, admin) {
  const matches=(actual,expected)=>actual?.length===expected.length&&expected.every((row,i)=>Object.entries(row).every(([key,value])=>actual[i][key]===value));
  const variable=(name,type,operator='4',triggersCalc='yes')=>({systemName:name,type,operator,negated:'no',triggersCalc});
  const action=(option,type,systemName,data,string='')=>({option,type,systemName,data,string,delay:'0'});
  const enabled=id=>source.groups.find(g=>g.id==='IX:AUTO:'+id)?.enabled===true;
  if(!enabled('0023')||!enabled('0025'))throw Error('Manövergrupperna måste granskas på nytt.');
  const lines={};
  for(const [i,id,button] of [[1,'AN','htvAn'],[2,'AU','htvAu'],[3,'BN','htvBn'],[4,'BU','htvBu'],[5,'CN','htvCn'],[6,'CU','htvCu'],[7,'D','htvD']]) {
    const rule=source.rules.find(r=>r.id==='IX:AUTO:0023C'+i);
    if(rule?.attributes.logicType!=='1'||rule.attributes.triggerOnChange!=='yes'||!matches(rule.variables,[variable('ss'+id,'1')])||!matches(rule.actions,[action('1','12','Action','-1','lock'+id),action('2','12','Action','-1','free'+id),action('3','16',' ','-1','preference:jython/HandlePanel.py')]))throw Error('Ändrad linjespärrregel: '+id);
    // The topology-derived button segment is attached by the profile builder.
    lines[id]={id,label:rule.name,button,rule:rule.id,sourceSensor:'ss'+id,blocks:[]};
  }
  const rule=source.rules.find(r=>r.id==='IX:AUTO:0025C1');
  const expected=[action('1','9','ProgOn','2'),action('1','2','ProgSpår','2'),action('1','2','Vx133','2'),action('2','2','ProgSpår','4'),action('2','9','ProgOn','4'),action('1','12','Action','-1','lockL3'),action('2','12','Action','-1','freeL3'),action('3','16',' ','-1','preference:jython/HandlePanel.py'),action('1','12','Action','-1','vxllockvxv133'),action('2','12','Action','-1','vxlunlockvxv133')];
  if(rule?.attributes.logicType!=='1'||rule.attributes.triggerOnChange!=='yes'||!matches(rule.variables,[variable('Programmering','1'),variable('Vx133','4','1','no')])||!matches(rule.actions,expected))throw Error('Programmeringsvillkoret måste granskas på nytt.');
  const relay=admin.turnouts.find(t=>t.id==='ProgSpår'&&t.sys==='LT134'),report=source.sensors.find(s=>s.name==='ProgOn'&&s.system==='LS940');
  if(!relay||!report||relay.inverted==='true'||report.attributes.inverted==='true')throw Error('Ändrade programmeringsbindningar.');
  return {lines,programming:{rule:rule.id,relayAddress:134,reportAddress:940,sourceRelay:'LT134',sourceReport:'LS940',turnout:'Vx133',requiredPosition:'C',blocks:['S133','SLIII','S133c'],clearBlocks:['S133'],
    provenance:'Source LT134 and LS940. Independent B1/B2 feedback is a conservative replacement; physical module behavior not commissioned.'}};
}
