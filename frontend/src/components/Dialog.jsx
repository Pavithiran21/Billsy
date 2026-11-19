import { useEffect, useId, useRef } from 'react';

/**
 * A modal dialog on the native <dialog> element: showModal() traps focus, Esc closes it (the
 * 'cancel' event), and the element marked data-autofocus (the safe button, or the first field)
 * gets focus first. React's autoFocus can't do that: it runs before showModal(), which then moves
 * focus to the first focusable element.
 * Render it only while open: <Dialog> mounts open and closes through onClose.
 * The body and footer sit inside one <form>, so Enter submits; onSubmit gets the event. A Dialog
 * must therefore never be rendered inside another <form>.
 */
export function Dialog({ title, subtitle, description, onClose, onSubmit, footer, wide = false, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[data-autofocus]')?.focus();
    }
    return () => dialog?.close();
  }, []);

  function handleCancel(event) {
    // Esc: let React decide (the parent unmounts the dialog).
    event.preventDefault();
    onClose();
  }

  return (
    <dialog
      ref={ref}
      className={`dlg ${wide ? 'dlg-wide' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
      >
        <div className="hd2">
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <div className="muted xs">{subtitle}</div> : null}
        </div>
        <div className="bd">
          {description ? (
            <p id={descriptionId} className="sm muted" style={{ marginBottom: 12 }}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
        <div className="ft">{footer}</div>
      </form>
    </dialog>
  );
}
