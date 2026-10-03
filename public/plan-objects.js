// Presentation helpers for the harmonised plan: which kind of label a text is, and
// which plan object a journal row refers to. Pure, no DOM, no orders.
export function labelClass(text){
  const t=String(text||'').trim();
  if(/^\d+[a-e]?$/i.test(t))return 'lbl-track';
  if(/^V\d$/i.test(t))return 'lbl-road';
  return 'lbl-place';
}
// Journal messages name their object first: "Signal 2a/11 …", "Vx162 …",
// "SIIIB: administrativ spärr …", "Au → Spår 1c: växlarna …".
export function objectFromMessage(message){
  const m=String(message||'').trim();let r;
  if((r=/^Signal (\S+)/.exec(m)))return {kind:'signal',name:r[1].replace(/[.,:]$/,'')};
  if((r=/\b(Vx\d+[a-z]?)\b/.exec(m)))return {kind:'turnout',name:r[1]};
  if((r=/\bväxel(?:n|arna)? (\d+[a-z]?)\b/i.exec(m)))return {kind:'turnout',name:'Vx'+r[1]};
  if((r=/^(.+? → .+?): /.exec(m)))return {kind:'route',name:r[1]};
  if((r=/^(S[A-Za-z0-9]+): /.exec(m)))return {kind:'block',name:r[1]};
  return null;
}
