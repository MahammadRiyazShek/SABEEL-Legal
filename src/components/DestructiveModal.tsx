/**
 * Destructive Operation Confirmation Dialog
 * Mandatory compliance component for Google Workspace API operations.
 */

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DestructiveModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  itemName?: string;
  confirmLabel?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DestructiveModal: React.FC<DestructiveModalProps> = ({
  isOpen,
  title,
  description,
  itemName,
  confirmLabel = 'Delete Permanently',
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="destructive-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-red-500/30 p-6 shadow-2xl text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-red-500/10 p-3 text-red-400 border border-red-500/20 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="flex-1">
            <h3 id="destructive-title" className="text-lg font-semibold text-zinc-100">
              {title}
            </h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              {description}
            </p>

            {itemName && (
              <div className="mt-3 rounded-lg bg-zinc-950/80 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 truncate">
                {itemName}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
