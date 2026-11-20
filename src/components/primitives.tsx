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
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
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

/**
 * A tool panel that takes the inspector's place beside the film, so sound,
 * subtitles and bulk edits never cover the picture. Focus moves into the
 * panel when it opens and Escape closes it.
 */
export function Panel({
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
  const reference = useRef<HTMLElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement;
    reference.current?.querySelector<HTMLElement>("h2")?.focus({
      preventScroll: true,
    });
    return () => {
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected &&
        reference.current?.contains(document.activeElement)
      )
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <aside
      ref={reference}
      className={`inspector side-panel ${className}`}
      aria-labelledby={titleId}
      data-geo="inspector"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="panel-title">
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        <IconButton icon={X} label={t("Close panel")} onClick={onClose} />
      </div>
      <div className="panel-body">{children}</div>
    </aside>
  );
}
