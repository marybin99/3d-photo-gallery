import { useEffect, useId, useRef, type ReactNode } from 'react';

export default function DeleteConfirmDialog({ children, busy, error, onCancel, onConfirm }: {
  children: ReactNode;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="admin-delete-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>삭제할까요?</h2>
      <p id={descriptionId}>{children}</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-actions">
        <button type="button" autoFocus disabled={busy} onClick={onCancel}>취소</button>
        <button type="button" className="admin-danger" disabled={busy} onClick={onConfirm}>
          {busy ? '삭제 중…' : '삭제하기'}
        </button>
      </div>
    </dialog>
  );
}
