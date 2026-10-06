// The ranger's requests (docs/rangerlage.md): each is a turnout group TKL lays on
// the ranger's request. The out positions come from the profile's own shunt
// route for the move, plus the protecting turnout where the source has one; the
// back positions are the boundaries' isolating positions, which the ranger may
// lay at any time. A request is therefore configuration, never a guess: a group
// whose route or boundary does not match the profile fails the build.
const spec=[
  {id:'left-11',label:'Vänster 11',side:'left',track:'11',route:'tvv3/1--tvv3/5',extra:{Vx102:'C'},protect:['Vx102']},
  {id:'left-12',label:'Vänster 12',side:'left',track:'12',route:'tvv3/1--tvv4/5',extra:{Vx102:'C'},protect:['Vx102']},
  {id:'left-13',label:'Vänster 13',side:'left',track:'13',route:'tvv3/1--tvv5/5',extra:{Vx102:'C'},protect:['Vx102']},
  {id:'right-11',label:'Höger 11',side:'right',track:'11',route:'tvv6/6--tvv3/10'},
  {id:'right-12',label:'Höger 12',side:'right',track:'12',route:'tvv6/6--tvv4/10'},
  {id:'right-13',label:'Höger 13',side:'right',track:'13',route:'tvv6/6--tvv5/10'},
  // 6/7 → 6/9 ends at 154; the pair 144/154 is laid together so the move continues to 3/11.
  {id:'six-154',label:'Spår 6 ut via 154',side:'six',route:'tvv6/7--tvv6/9',extra:{Vx154:'T'}},
  {id:'3d-left',label:'3d ut åt vänster',side:'3d',route:'tvv3/2--tvv3/6'}
];
export function compileRangerRequests(profile){
  const boundaries=profile.yardBoundaries||{};
  return spec.map(s=>{
    const route=profile.routes.find(r=>r.id===s.route);
    if(!route||route.kind!=='shunt')throw Error('Begärans växeltågväg saknas i profilen: '+s.route);
    const out={...route.turnouts,...(s.extra||{})};
    for(const [name,position] of Object.entries(out))if(!profile.turnouts[name]||!['C','T'].includes(position))throw Error('Begärans växel måste granskas: '+name);
    // Every boundary in the group is laid open by the request and closes on the way
    // back, except a protecting turnout (102 towards spår 2), which the request
    // lays in its closed position and the ranger may lay there at any time.
    const back={};
    for(const name of Object.keys(out))if(boundaries[name]){
      const closed=boundaries[name].rangerPositions[0],protect=(s.protect||[]).includes(name);
      if((out[name]===closed)!==protect)throw Error('Begärans gränsväxel stämmer inte med skyddsläget: '+s.id+' '+name);
      if(!protect)back[name]=closed;
    }
    if(!Object.keys(back).length)throw Error('Begäran passerar ingen gränsväxel: '+s.id);
    // 153 is coupled with 161 and closes 3d off from 161 when thrown.
    if(s.id==='3d-left')back.Vx153='T';
    return {id:s.id,label:s.label,side:s.side,...(s.track?{track:s.track}:{}),route:s.route,out,back,provenance:'Anläggningsägarens beslut 2026-10-06; lägen ur profilens växeltågväg '+route.label+'.'};
  });
}
