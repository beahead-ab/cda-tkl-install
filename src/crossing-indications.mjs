// Read-only warning presentation for the three road lines in the source panel.
// Track geometry determines which blocks and route paths cross each road.
export function crosses(a, b) {
  const ax = a.x2 - a.x1, ay = a.y2 - a.y1;
  const bx = b.x2 - b.x1, by = b.y2 - b.y1;
  const denominator = ax * by - ay * bx;
  if (Math.abs(denominator) < 1e-9) return false;
  const dx = b.x1 - a.x1, dy = b.y1 - a.y1;
  const t = (dx * by - dy * bx) / denominator;
  const u = (dx * ay - dy * ax) / denominator;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9;
}

export function crossingGeometry(panel, name) {
  if (!['V1', 'V2', 'V3'].includes(name)) return null;
  const roads = panel.segs.filter(s => s.b === name.toLowerCase() && !s.hide);
  if (roads.length !== 1) throw Error('Övergångens streck måste vara entydigt: ' + name);
  const {id, x1, y1, x2, y2} = roads[0];
  const line = {id, x1, y1, x2, y2};
  const tracks = panel.segs.filter(s => !s.hide && !/^v[1-4][nu]?$|^frame$/i.test(s.b));
  for (const t of Object.values(panel.turnouts)) {
    for (const [x, y] of [[t.ax, t.ay], [t.bx, t.by], [t.ccx, t.ccy]]) {
      if (Number.isFinite(x) && Number.isFinite(y)) tracks.push({x1: t.cx, y1: t.cy, x2: x, y2: y, b: t.block});
    }
  }
  const blocks = [...new Set(tracks.filter(s => s.b && crosses(line, s)).map(s => s.b))].sort();
  if (!blocks.length) throw Error('Inga korsande spår hittades: ' + name);
  return {line, blocks};
}

export function prepareCrossing(geometry, profile) {
  return {...geometry, routeIds: profile.routes.filter(r => (r.flow || []).some(part => crosses(geometry.line, part))).map(r => r.id)};
}

export function crossingWarning(crossing, state, profile) {
  const usable = state.connection === 'connected' && !state.storageFault;
  const unavailable = state.storageFault ? 'Lagringsfel' : 'Anläggningen är frånkopplad';
  // Any retained reservation counts, from establishment until its locks release.
  const routes = state.routes.filter(r => r.flow ? r.flow.some(part=>crosses(crossing.line,part)) : crossing.routeIds.includes(r.definitionId));
  const conditions = [{kind: 'route', id: crossing.line.id, label: 'Tågväg över övergången',
    value: usable ? routes.length > 0 : null,
    reason: !usable ? unavailable : routes.length ? routes.map(r => r.label).join(', ') + ' · reservation kvar' : 'Ingen reservation'}];
  for (const name of crossing.blocks) {
    const report = state.blocks[name];
    const fresh = profile.blocks[name] && report && typeof report.occupied === 'boolean' && report.updatedAt > 0 &&
      state.serverTime >= report.updatedAt && state.serverTime - report.updatedAt <= profile.staleMs;
    const value = usable && fresh ? report.occupied : null;
    conditions.push({kind: 'block', id: name, label: name, value,
      reason: !usable ? unavailable : value === true ? 'Korsande block är belagt' : value === false ? 'Korsande block är fritt' : 'Saknad eller gammal beläggningsrapport'});
  }
  return {value: conditions.some(c => c.value === true) ? true : conditions.every(c => c.value === false) ? false : null,
    complete: conditions.every(c => c.value !== null), known: conditions.filter(c => c.value !== null).length, total: conditions.length, conditions};
}
