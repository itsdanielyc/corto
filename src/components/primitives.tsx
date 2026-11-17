import { useT } from "../i18n/locale";
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
export function IconButton({
  icon: Icon,
  label,
  className = "",
  ...properties
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  const t = useT();
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={t(label)}
      title={t(label)}
      {...properties}
    >
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );
}
/** Native dialogs provide focus trapping, Escape handling and focus restoration. */
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const t = useT();
  const reference = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = reference.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={reference}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <IconButton icon={X} label={t("Close dialog")} onClick={onClose} />
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
