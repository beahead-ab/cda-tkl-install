// Fullscreen the document so status messages and floating details stay visible.
export function createFullscreen({button, onError}) {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const leave = document.exitFullscreen || document.webkitExitFullscreen;
  const active = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  let pending = false;

  function sync() {
    const enabled = active();
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('span').textContent = enabled ? 'Avsluta fullskärm' : 'Fullskärm';
    button.title = enabled ? 'Avsluta fullskärm · Esc' : 'Visa i fullskärm';
  }

  async function change(exitOnly = false) {
    if (pending || (exitOnly && !active())) return;
    if (!request || !leave) {
      onError('Fullskärm stöds inte i den här webbläsarvyn. Öppna appen i ett eget webbläsarfönster och prova igen.');
      return;
    }
    pending = true;
    button.disabled = true;
    try {
      if (active()) await leave.call(document);
      else await request.call(root);
    } catch {
      onError('Webbläsaren kunde inte växla fullskärmsläge. Prova igen eller öppna appen i ett eget webbläsarfönster.');
    } finally {
      pending = false;
      button.disabled = false;
      sync();
    }
  }

  button.addEventListener('click', () => change());
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
  return {active, exit: () => change(true)};
}
