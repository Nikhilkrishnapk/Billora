/**
 * The bill being created. Shared by Create Bill, the item sheet and the barcode
 * scanner. Cleared by "New bill".
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { DraftItem } from '../types';

export type ItemFormPrefill = Partial<Omit<DraftItem, 'key'>> & { key?: string };

interface DraftState {
  requestId: string;
  customerMobile: string;
  customerName: string;
  items: DraftItem[];
  /** When set, Create Bill opens the item sheet with these values (e.g. after a scan). */
  pendingForm: ItemFormPrefill | null;
}

interface DraftApi extends DraftState {
  setCustomerMobile: (v: string) => void;
  setCustomerName: (v: string) => void;
  upsertItem: (item: Omit<DraftItem, 'key'> & { key?: string }) => void;
  removeItem: (key: string) => void;
  /** Adds 1 to the row with this barcode. Returns false if there is no such row. */
  incrementBarcode: (barcode: string) => boolean;
  hasBarcode: (barcode: string) => boolean;
  openForm: (prefill: ItemFormPrefill | null) => void;
  consumePendingForm: () => ItemFormPrefill | null;
  reset: () => void;
  isDirty: boolean;
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const fresh = (): DraftState => ({
  requestId: newId(),
  customerMobile: '',
  customerName: '',
  items: [],
  pendingForm: null,
});

const Ctx = createContext<DraftApi | null>(null);

export function DraftBillProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DraftState>(fresh);

  const upsertItem = useCallback((item: Omit<DraftItem, 'key'> & { key?: string }) => {
    setState(s => {
      if (item.key && s.items.some(i => i.key === item.key)) {
        return { ...s, items: s.items.map(i => (i.key === item.key ? ({ ...item, key: i.key } as DraftItem) : i)) };
      }
      return { ...s, items: [...s.items, { ...item, key: newId() } as DraftItem] };
    });
  }, []);

  const incrementBarcode = useCallback(
    (barcode: string) => {
      if (!state.items.some(i => i.barcode === barcode)) return false;
      setState(s => ({
        ...s,
        items: s.items.map(i => (i.barcode === barcode ? { ...i, quantity: Math.round((i.quantity + 1) * 1000) / 1000 } : i)),
      }));
      return true;
    },
    [state.items],
  );

  const api = useMemo<DraftApi>(
    () => ({
      ...state,
      setCustomerMobile: v => setState(s => ({ ...s, customerMobile: v })),
      setCustomerName: v => setState(s => ({ ...s, customerName: v })),
      upsertItem,
      removeItem: key => setState(s => ({ ...s, items: s.items.filter(i => i.key !== key) })),
      incrementBarcode,
      hasBarcode: barcode => state.items.some(i => i.barcode === barcode),
      openForm: prefill => setState(s => ({ ...s, pendingForm: prefill ?? {} })),
      consumePendingForm: () => {
        const p = state.pendingForm;
        if (p) setState(s => ({ ...s, pendingForm: null }));
        return p;
      },
      reset: () => setState(fresh()),
      isDirty: !!(state.customerMobile || state.customerName || state.items.length),
    }),
    [state, upsertItem, incrementBarcode],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDraftBill() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDraftBill outside DraftBillProvider');
  return v;
}
