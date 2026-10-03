const $ = id => document.getElementById(id), esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state, ready = false, busy = false;
function trainReason(s) {
  if (!state.link || !state.clients) return 'Anslut TKL till LocoNet först.';
  const stop = (s.signals || [s.signal]).find(n => !state.signals[n]?.code);
  if (stop) return `Signal ${stop} visar stopp.`;
  if (s.turnouts && Object.entries(s.turnouts).some(([n,p]) => state.turnouts[n]?.position !== p)) return 'Växlarna ligger för en annan färd.';
  if (s.blocks.some(n => state.blocks[n])) return 'Färdvägen är belagd.';
  if ((state.trains || []).some(t => t.blocks.some(n => s.blocks.includes(n)))) return 'Ett tåg använder färdvägen.';
  return '';
}
function paintTrains() {
  const selected = $('train-choice').value;
  const scenarios = state.scenarios.filter(s => !$('train-ready-only').checked || !trainReason(s));
  const options = scenarios.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') || '<option value="">Inga färder klara – lägg en tågväg i TKL</option>';
  if ($('train-choice').innerHTML !== options) { $('train-choice').innerHTML = options; if (scenarios.some(s => s.id === selected)) $('train-choice').value = selected; }
  const path = scenarios.find(s => s.id === $('train-choice').value);
  const reason = path ? trainReason(path) : 'Väntar på körbesked från anläggningen.';
  $('start-train').disabled = busy || !path || !!reason;
  $('train-reason').textContent = reason || `Signal ${path.signal} visar kör. Ett nytt tåg kan starta.`;
}
function paintBlocks() {
  let visible = 0;
  for (const b of $('blocks').children) {
    const occupied = state.blocks[b.dataset.block];
    b.classList.toggle('occupied', occupied); b.setAttribute('aria-pressed', occupied);
    b.hidden = !b.dataset.block.toLowerCase().includes($('block-search').value.toLowerCase()) || ($('occupied-only').checked && !occupied);
    if (!b.hidden) visible++;
  }
  $('block-count').textContent = `${visible} av ${Object.keys(state.blocks).length}`;
}
async function act(path, data) {
  if (busy) return; busy = true;
  try { const r = await fetch('api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const a = await r.json(); if (!r.ok) throw Error(a.error); $('message').hidden = true; }
  catch (e) { $('message').textContent = e.message; $('message').hidden = false; }
  finally { busy = false; await poll(); }
}
async function poll() {
  try {
    const response = await fetch('api/state'); if (response.status === 401 || response.status === 428) { location.assign('/login'); return; } state = await response.json();
    if (!ready) {
      $('blocks').innerHTML = Object.keys(state.blocks).map(n => `<button data-block="${n}">${n}</button>`).join('');
      for (const [kind, source] of [['turnout', 'turnouts'], ['signal', 'signals'], ['sensor', 'blocks']]) {
        $('fault-' + kind).innerHTML += Object.keys(state[source]).map(n => `<option value="${n}">${n}</option>`).join('');
        $('fault-' + kind).onchange = e => act('fault', { kind, name: e.target.value });
      }
      ready = true;
    }
    $('sim-connection').textContent = state.link ? state.clients + ' LocoNet-klient ansluten' : 'LocoNet bruten'; $('sim-connection').className = 'connection ' + (state.clients ? 'online' : 'offline');
    $('link').textContent = state.link ? 'Bryt LocoNet' : 'Återanslut LocoNet';
    paintBlocks(); paintTrains();
    $('field-programming').hidden=!state.programming;
    if(state.programming){$('field-programming-state').textContent=state.programming.relay==='unknown'?'Kopplar om':state.programming.active?'Programmeringsmatning':'Normal matning';$('fault-programming').checked=state.programming.fault;}
    $('train-status').textContent = state.trains?.length ? state.trains.map(t => `${t.number} · ${t.label}${t.waiting ? ' · '+t.waiting : ''}`).join(' · ') : 'Inget tåg i rörelse';
    $('signal-count').textContent = `${Object.values(state.signals).filter(s => s.code).length} kör / ${Object.keys(state.signals).length}`;
    $('turnout-count').textContent = Object.keys(state.turnouts).length;
    $('signals').innerHTML = Object.entries(state.signals).map(([n, s]) => `<span class="field-chip ${s.code ? 'go' : ''}">${n} · ${s.code ? 'KÖR' : 'STOPP'} · ${s.code}</span>`).join('');
    $('turnouts').innerHTML = Object.entries(state.turnouts).map(([n, s]) => `<span class="field-chip">${n} · ${{ C: 'Rakt', T: 'Avvikande', unknown: 'Rör sig / okänt' }[s.position]}</span>`).join('');
    for (const kind of ['turnout', 'signal', 'sensor']) if (document.activeElement !== $('fault-' + kind)) $('fault-' + kind).value = state.faults[kind];
    $('trace').textContent = state.trace.slice(0, 35).map(e => `${new Date(e.at).toLocaleTimeString('sv-SE')}  ${e.direction === 'in' ? 'ORDER ' : 'RAPPORT'}  ${e.hex}`).join('\n');
  } catch (e) { $('sim-connection').textContent = 'Kontakt med anläggningen saknas'; $('sim-connection').className = 'connection offline'; }
}
$('blocks').onclick = e => { const name = e.target.closest('button')?.dataset.block; if (name) act('block', { name, occupied: !state.blocks[name] }); };
$('start-train').onclick = () => act('train', { id: $('train-choice').value });
$('train-choice').onchange = paintTrains; $('train-ready-only').onchange = paintTrains;
$('block-search').oninput = paintBlocks; $('occupied-only').onchange = paintBlocks;
$('fault-programming').onchange=e=>act('programming-fault',{enabled:e.target.checked});
$('link').onclick = () => act('link', { connected: !state.link });
try { const response = await fetch('api/config'); if (!response.ok) throw Error(); const config = await response.json(); $('tkl-link').href = config.tklUrl; $('tkl-link').hidden = false; } catch {}
await poll(); setInterval(poll, 400);
