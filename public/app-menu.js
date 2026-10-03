export function createAppMenu({button, popup}) {
  const items = () => [...popup.querySelectorAll('a[href], button')].filter(n => !n.hidden && !n.disabled);
  function close(restoreFocus = false) {
    if (popup.hidden) return false;
    popup.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Öppna meny');
    if (restoreFocus) button.focus();
    return true;
  }
  function open(focusFirst = false) {
    const bounds = button.getBoundingClientRect();
    const top = Math.min(bounds.bottom + 8, window.innerHeight - 80);
    popup.style.top = top + 'px';
    popup.style.maxHeight = Math.max(64, window.innerHeight - top - 8) + 'px';
    const alignLeft=bounds.left+bounds.width/2<window.innerWidth/2;
    popup.style.left = alignLeft?Math.max(8,bounds.left)+'px':'auto';
    popup.style.right = alignLeft?'auto':Math.max(8,window.innerWidth-bounds.right)+'px';
    popup.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Stäng meny');
    if (focusFirst) items()[0]?.focus();
  }
  button.addEventListener('click', () => popup.hidden ? open() : close());
  button.addEventListener('keydown', e => {if (e.key === 'ArrowDown') {e.preventDefault(); open(true);}});
  popup.addEventListener('keydown', e => {
    const choices = items(), index = choices.indexOf(document.activeElement);
    let next;
    if (e.key === 'ArrowDown') next = (index + 1) % choices.length;
    if (e.key === 'ArrowUp') next = (index - 1 + choices.length) % choices.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = choices.length - 1;
    if (next !== undefined) {e.preventDefault(); choices[next]?.focus();}
  });
  popup.addEventListener('click', e => {if (e.target.closest('a,button')) close(true);});
  document.addEventListener('pointerdown', e => {if (!popup.contains(e.target) && !button.contains(e.target)) close();});
  document.addEventListener('focusin', e => {if (!popup.contains(e.target) && !button.contains(e.target)) close();});
  // Close the navigation before Escape can leave fullscreen or clear a panel choice.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !popup.hidden) {e.preventDefault(); e.stopImmediatePropagation(); close(true);}
  }, true);
  window.addEventListener('resize', () => close());
  return {close};
}
