// Native modality keeps clicks used to dismiss details from manoeuvring the track behind them.
export function createContextDialog({dialog, onClose}) {
  let anchor, origin;
  function position() {
    if (!dialog.open || !anchor) return;
    const {width, height} = dialog.getBoundingClientRect(), gap = 12, edge = 8;
    const x = anchor.x + gap + width <= innerWidth - edge ? anchor.x + gap : anchor.x - width - gap;
    const y = anchor.y + gap + height <= innerHeight - edge ? anchor.y + gap : anchor.y - height - gap;
    dialog.style.left = Math.max(edge, Math.min(x, innerWidth - width - edge)) + 'px';
    dialog.style.top = Math.max(edge, Math.min(y, innerHeight - height - edge)) + 'px';
  }
  function close(restoreFocus = true) {
    if (!dialog.open) return;
    dialog.close();
    onClose();
    if (restoreFocus && origin?.isConnected) origin.focus({preventScroll:true});
  }
  dialog.addEventListener('cancel', e => {e.preventDefault(); close();});
  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape') {e.preventDefault(); e.stopPropagation(); close();}
  });
  const outside = e => {const r = dialog.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;};
  let startedOutside = false;
  dialog.addEventListener('pointerdown', e => {startedOutside = e.target === dialog && outside(e);});
  dialog.addEventListener('click', e => {if (startedOutside && e.target === dialog && outside(e)) close(); startedOutside = false;});
  window.addEventListener('resize', position);
  new ResizeObserver(position).observe(dialog);
  return {close, open(event, fallback) {
    origin = event?.currentTarget || fallback || document.activeElement;
    const rect = origin?.getBoundingClientRect();
    anchor = event?.clientX || event?.clientY ? {x:event.clientX, y:event.clientY} : {x:rect ? rect.left + rect.width / 2 : innerWidth / 2, y:rect ? rect.top + rect.height / 2 : innerHeight / 2};
    if (!dialog.open) dialog.showModal();
    position();
    dialog.querySelector('[autofocus]')?.focus({preventScroll:true});
  }};
}
