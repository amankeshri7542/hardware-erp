import { getPdfStatus } from '../api/invoices.api';

/**
 * Poll PDF generation status for an invoice.
 * Returns a cleanup function to stop polling.
 */
export function pollPdfStatus(invoiceId, {
  onReady,
  onFailed,
  onTimeout,
  interval = 1000,
  maxAttempts = 10,
} = {}) {
  let attempts = 0;

  const timer = setInterval(async () => {
    attempts++;
    try {
      const { data } = await getPdfStatus(invoiceId);
      const status = data.data?.pdf_status;

      if (status === 'ready') {
        clearInterval(timer);
        if (onReady) onReady({ pdf_url: data.data.pdf_url });
      } else if (status === 'failed') {
        clearInterval(timer);
        if (onFailed) onFailed();
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        if (onTimeout) onTimeout();
      }
    } catch {
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        if (onTimeout) onTimeout();
      }
    }
  }, interval);

  // Return cleanup function
  return () => clearInterval(timer);
}
