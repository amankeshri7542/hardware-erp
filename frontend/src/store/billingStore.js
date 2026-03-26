import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useBillingStore = create(
  persist(
    (set, get) => ({
      draftItems: [],
      draftCustomer: null,
      draftBillType: 'retail',
      draftPayment: { amount_paid: 0, modes: [], due_date: null },

      saveDraft: (items, customer, billType, payment) => {
        // Strip cost_price_snapshot from items before persisting (security)
        const safeItems = items.map(({ cost_price_snapshot, line_profit, ...rest }) => rest);
        set({
          draftItems: safeItems,
          draftCustomer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, type: customer.type } : null,
          draftBillType: billType,
          draftPayment: payment,
        });
      },

      clearDraft: () => set({
        draftItems: [],
        draftCustomer: null,
        draftBillType: 'retail',
        draftPayment: { amount_paid: 0, modes: [], due_date: null },
      }),

      get hasDraft() {
        return get().draftItems.length > 0;
      },
    }),
    {
      name: 'hardware-erp-billing-draft',
      partialize: (state) => ({
        draftItems: state.draftItems,
        draftCustomer: state.draftCustomer,
        draftBillType: state.draftBillType,
        draftPayment: state.draftPayment,
      }),
    }
  )
);

export default useBillingStore;
