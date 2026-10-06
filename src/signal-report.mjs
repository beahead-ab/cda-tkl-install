// Hur en signal återrapporterar sitt besked. 'se': Signal10:s SE-telegram (E4 09) med beskedskoder på rapportadressen.
// 'switch': växelrapporten (B1) på rapportadressen, som JMRI:s feedback MONITORING läste: CLOSED = kör, THROWN = stopp.
// Profilen bär standarden i signalReport.kind; en signal kan avvika med reportKind. Allt annat räknas som 'se'.
export const REPORT_KINDS = ['se', 'switch'];
export function signalReportKind(profile, binding) {
  if (!binding || binding.virtual) return null;
  const own = binding.reportKind;
  if (REPORT_KINDS.includes(own)) return own;
  const base = profile?.signalReport?.kind;
  return REPORT_KINDS.includes(base) ? base : 'se';
}
// Beskedet ur en växelrapport på signalens rapportadress.
export function aspectFromSwitch(position) { return position === 'C' ? 'go' : position === 'T' ? 'stop' : 'unknown'; }
