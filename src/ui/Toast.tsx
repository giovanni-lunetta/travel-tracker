/** The undo toast and the confirmation dialog. Both are driven by the store. */
import { useEffect, useRef } from 'preact/hooks';
import { store } from '../store';

export function Toast() {
  const t = store.toast.value;
  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(() => { if (store.toast.value?.id === t.id) store.dismissToast(); }, t.kind === 'error' ? 9000 : 5500);
    return () => window.clearTimeout(id);
  }, [t?.id]);
  if (!t) return null;
  return (
    <div class={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'} key={t.id}>
      <span class="toast-msg">{t.message}</span>
      {t.actions.map((a) => (
        <button class="toast-btn" onClick={async () => { store.dismissToast(); await a.run(); }}>{a.label}</button>
      ))}
    </div>
  );
}

export function ConfirmDialog() {
  const c = store.confirm.value;
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!c) return;
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') c.onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c]);
  if (!c) return null;
  return (
    <div class="modal-scrim" onClick={c.onCancel}>
      <div class="modal" role="alertdialog" aria-labelledby="dlg-title" aria-describedby="dlg-body" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title">{c.title}</h2>
        <p id="dlg-body">{c.body}</p>
        <div class="btn-row">
          <button class="btn" ref={cancel} onClick={c.onCancel}>Cancel</button>
          <button class="btn danger" onClick={() => void c.onConfirm()}>{c.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
