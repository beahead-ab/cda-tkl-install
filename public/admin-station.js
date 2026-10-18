// Inställningar → Station. Bara installerade stationspaket visas; servern avgör när ett byte får göras.
import { confirmAdmin } from './admin-ui.js';

export function createStationSettings(root, { api, message = () => {}, session = () => null } = {}) {
  if (!root) return null;
  root.innerHTML = `<p>Installationen kör en station åt gången. Vid byte startas programmet om. Varje station behåller sina egna användare, inställningar och lås.</p>
    <p data-station-current></p><form><label>Station<select data-station-select aria-label="Station"></select></label>
    <p data-station-reason class="muted" role="status"></p><p><button type="submit" class="primary" data-station-change>Byt station och starta om</button></p></form>
    <p class="muted" data-station-trainmeet></p><p><a href="#trainmeet">Öppna TrainMeet</a></p>
    <p class="muted">Listan visar stationer som redan är installerade på den här datorn.</p>
    <p data-station-error class="admin-form-error" role="alert" hidden></p>`;
  const $ = selector => root.querySelector(selector);
  let view = null, busy = false, timer = null, destroyed = false;
  function paint(next) {
    if (!next) return;
    const previous = $('[data-station-select]').value;
    view = next;
    $('[data-station-current]').textContent = 'Nu körs ' + view.title + '.';
    const select = $('[data-station-select]');
    select.replaceChildren(...view.stations.map(station => {
      const option = document.createElement('option'); option.value = station.id; option.textContent = station.title + (station.current ? ' (nu)' : ''); return option;
    }));
    select.value = view.stations.some(station => station.id === previous) ? previous : view.current;
    select.disabled = busy || view.locked || view.restarting || session()?.user?.role !== 'owner';
    $('[data-station-trainmeet]').textContent = view.requireTrainMeetConnect
      ? 'TrainMeet är pausad efter stationsbytet. Öppna TrainMeet och anslut med den här stationens serveradress och anslutningskod. Sparad parkoppling ansluts inte av sig själv.'
      : 'Efter ett stationsbyte ansluter du själv till den valda stationens TrainMeet-server.';
    controls();
  }
  function controls() {
    const target = view?.stations.find(station => station.id === $('[data-station-select]').value);
    const owner = session()?.user?.role === 'owner';
    $('[data-station-reason]').textContent = view?.reason || (!owner ? 'Logga in som stationens ägare för att byta station.' : '') || target?.reason || 'Programmet avslutar nuvarande station innan den valda stationen startas.';
    $('[data-station-change]').disabled = busy || !owner || !target?.allowed;
  }
  async function load() {
    try {
      const response = await fetch('/api/installation/station', { cache: 'no-store' });
      const answer = await response.json(); if (!response.ok) throw Error(answer.error || 'Stationsvalet kunde inte läsas.');
      $('[data-station-error]').hidden = true; paint(answer);
    } catch (error) { $('[data-station-error]').textContent = error.message; $('[data-station-error]').hidden = false; }
  }
  async function waitForRestart(stationId) {
    let attempts = 0;
    async function probe() {
      if (destroyed) return;
      try {
        const response = await fetch('/api/config', { cache: 'no-store' });
        if (response.status === 401 || response.status === 428) { window.location.assign('/login'); return; }
        if (response.ok && (await response.json()).station?.id === stationId) { window.location.reload(); return; }
      } catch {}
      if (++attempts >= 45) {
        $('[data-station-error]').textContent = 'Omstarten kunde inte bekräftas. Läs om sidan och kontrollera vilken station som körs.';
        $('[data-station-error]').hidden = false; return;
      }
      timer = setTimeout(probe, 1000);
    }
    timer = setTimeout(probe, 500);
  }
  $('[data-station-select]').onchange = controls;
  root.querySelector('form').onsubmit = event => {
    event.preventDefault(); const target = view?.stations.find(station => station.id === $('[data-station-select]').value);
    if (!target?.allowed || busy) return;
    confirmAdmin({ title: 'Byt station', message: 'Avsluta ' + view.title + ' och starta ' + target.title + '? Du loggar sedan in med den stationens användare och ansluter själv till TrainMeet.', button: 'Byt och starta om', action: async () => {
      busy = true; controls();
      try {
        const answer = await api('installation/station', { stationId: target.id });
        if (!answer?.restarting) { busy = false; await load(); return false; }
        $('[data-station-reason]').textContent = 'Programmet startas om med ' + target.title + '. Vänta…';
        $('[data-station-select]').disabled = true; message('Stationen byts. Panelen läses om när den är klar.', { error: false, duration: 6000 });
        waitForRestart(target.id); return true;
      } catch (error) { busy = false; controls(); throw error; }
    } });
  };
  load();
  return { load, update(state) { if (state?.installationStation && !busy) paint(state.installationStation); }, destroy() { destroyed = true; clearTimeout(timer); } };
}
