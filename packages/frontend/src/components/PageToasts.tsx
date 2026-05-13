import { useEffect } from "react";

export interface PageToastsProps {
  error: string | null;
  success: string | null;
  onDismissError: () => void;
  onDismissSuccess: () => void;
}

/**
 * Всплывающие уведомления об ошибке и успехе (фиксированный слой, не в потоке формы).
 */
export function PageToasts({
  error,
  success,
  onDismissError,
  onDismissSuccess,
}: PageToastsProps) {
  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => {
      onDismissSuccess();
    }, 5200);
    return () => window.clearTimeout(id);
  }, [success, onDismissSuccess]);

  if (!error && !success) return null;

  return (
    <div className="page-toast-stack" aria-live="polite">
      {error ? (
        <div role="alert" className="page-toast page-toast--error">
          <p className="page-toast__text">{error}</p>
          <button
            type="button"
            className="page-toast__close"
            aria-label="Закрыть"
            onClick={onDismissError}
          >
            ×
          </button>
        </div>
      ) : null}
      {success ? (
        <div role="status" className="page-toast page-toast--success">
          <p className="page-toast__text">{success}</p>
          <button
            type="button"
            className="page-toast__close"
            aria-label="Закрыть"
            onClick={onDismissSuccess}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
