// TrainMeet shows a pairing code as 123-456 and ignores the hyphen and letter case
// when it checks one. The field formats the same way while the operator types.
export function formatPairingCode(value){
  const clean=String(value??'').toUpperCase().replace(/[^\p{L}\p{N}]/gu,'');
  return clean.length>3?clean.slice(0,3)+'-'+clean.slice(3):clean;
}
