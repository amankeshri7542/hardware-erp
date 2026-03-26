import { useEffect } from 'react';

/**
 * Centralises billing keyboard shortcuts.
 * Ignores keys when an Ant Design Modal is open.
 */
export function useKeyboardBilling({ onF2, onF9, onEscape }) {
  useEffect(() => {
    const handler = (e) => {
      // Ignore if modal is open
      const modalOpen = document.querySelector('.ant-modal-wrap:not([style*="display: none"])');
      if (modalOpen) return;

      switch (e.key) {
        case 'F2':
          e.preventDefault();
          if (onF2) onF2();
          break;
        case 'F9':
          e.preventDefault();
          if (onF9) onF9();
          break;
        case 'Escape':
          if (onEscape) onEscape();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onF2, onF9, onEscape]);
}

export default useKeyboardBilling;
