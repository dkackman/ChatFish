import type { Toast } from "../state/fishStore";
import { positionClasses, type FloatingPosition } from "./positioning";

interface FloatingToastProps {
  isVisible: boolean;
  position: FloatingPosition;
  toast: Toast | null;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export function FloatingToast({ isVisible, position, toast, showCloseButton = true, onClose }: FloatingToastProps) {
  if (!isVisible || !toast) {
    return null;
  }
  return (
    <div className={positionClasses(position)}>
      <div className="toast show floating-component" role="alert" aria-live="assertive" aria-atomic="true">
        <div className="toast-header floating-header">
          <strong className="me-auto">{toast.title}</strong>
          {showCloseButton && (
            <button type="button" className="btn-close floating-close" onClick={onClose} aria-label="Close"></button>
          )}
        </div>
        <div className="toast-body floating-body">
          <p>{toast.caption}</p>
          {toast.messages && toast.messages.length > 0 && (
            <ul className="list-unstyled mb-0 ps-3">
              {toast.messages.map((m) => (
                <li key={m} className="ms-3 mb-2">
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
