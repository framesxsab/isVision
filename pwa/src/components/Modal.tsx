import type { ReactNode } from "react";
import { FocusTrap } from "@/core/a11y/FocusTrap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
      <FocusTrap active>
        <div
          className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          aria-labelledby="modal-title"
        >
          <h2 id="modal-title" className="text-xl font-bold text-white mb-4">
            {title}
          </h2>
          {children}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 min-h-touch min-w-touch text-gray-400 hover:text-white"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
      </FocusTrap>
    </div>
  );
}
