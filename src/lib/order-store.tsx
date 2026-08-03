import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  categoryPrice,
  getCategory,
  getIngredient,
  ingredientItems,
  seedPastOrders,
  type OrderIngredientLine,
  type OrderLine,
  type OrderStatus,
  type PastOrder,
  type PortionSize,
} from "./mock-data";

interface OrderState {
  lines: OrderLine[];
  extras: OrderIngredientLine[];
  pickupWindowId: string | null;
  currentOrderId: string | null;
  currentOrderStatus: OrderStatus;
  pastOrders: PastOrder[];
}

interface OrderContextValue extends OrderState {
  addLine: (categoryId: string, portion: PortionSize, quantity: number) => void;
  updateLineQty: (categoryId: string, portion: PortionSize, quantity: number) => void;
  removeLine: (categoryId: string, portion: PortionSize) => void;
  setExtraQty: (ingredientId: string, quantity: number) => void;
  setPickupWindow: (id: string) => void;
  submitOrder: () => string;
  reorder: (order: PastOrder) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const STORAGE_KEY = "tg-order-v1";

const OrderContext = createContext<OrderContextValue | null>(null);

const initialState: OrderState = {
  lines: [],
  extras: [],
  pickupWindowId: null,
  currentOrderId: null,
  currentOrderStatus: "received",
  pastOrders: seedPastOrders,
};

export function OrderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrderState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialState, ...JSON.parse(raw) });
    } catch {
      // Ignore malformed local cart state and start fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota/private-mode write failures.
    }
  }, [state, hydrated]);

  const addLine = useCallback((categoryId: string, portion: PortionSize, quantity: number) => {
    setState((s) => {
      const idx = s.lines.findIndex((l) => l.categoryId === categoryId && l.portion === portion);
      if (idx >= 0) {
        const lines = [...s.lines];
        lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + quantity };
        return { ...s, lines };
      }
      return { ...s, lines: [...s.lines, { categoryId, portion, quantity }] };
    });
  }, []);

  const updateLineQty = useCallback(
    (categoryId: string, portion: PortionSize, quantity: number) => {
      setState((s) => ({
        ...s,
        lines: s.lines
          .map((l) =>
            l.categoryId === categoryId && l.portion === portion ? { ...l, quantity } : l,
          )
          .filter((l) => l.quantity > 0),
      }));
    },
    [],
  );

  const removeLine = useCallback((categoryId: string, portion: PortionSize) => {
    setState((s) => ({
      ...s,
      lines: s.lines.filter((l) => !(l.categoryId === categoryId && l.portion === portion)),
    }));
  }, []);

  const setExtraQty = useCallback((ingredientId: string, quantity: number) => {
    setState((s) => {
      const others = s.extras.filter((e) => e.ingredientId !== ingredientId);
      if (quantity <= 0) return { ...s, extras: others };
      return { ...s, extras: [...others, { ingredientId, quantity }] };
    });
  }, []);

  const setPickupWindow = useCallback((id: string) => {
    setState((s) => ({ ...s, pickupWindowId: id }));
  }, []);

  const submitOrder = useCallback(() => {
    const id = `TG-${Math.floor(1100 + Math.random() * 900)}`;
    setState((s) => ({
      ...s,
      currentOrderId: id,
      currentOrderStatus: "received",
    }));
    return id;
  }, []);

  const clearCart = useCallback(() => {
    setState((s) => ({ ...s, lines: [], extras: [], pickupWindowId: null }));
  }, []);

  const reorder = useCallback((order: PastOrder) => {
    setState((s) => ({
      ...s,
      lines: order.lines.map((l) => ({ ...l })),
      extras: order.extras.map((e) => ({ ...e })),
      pickupWindowId: null,
    }));
  }, []);

  const { subtotal, totalItems } = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const l of state.lines) {
      const cat = getCategory(l.categoryId);
      if (!cat) continue;
      sum += categoryPrice(cat, l.portion) * l.quantity;
      count += l.quantity;
    }
    for (const e of state.extras) {
      const ing = getIngredient(e.ingredientId);
      if (!ing) continue;
      sum += ing.price * e.quantity;
      count += e.quantity;
    }
    return { subtotal: sum, totalItems: count };
  }, [state.lines, state.extras]);

  const value: OrderContextValue = {
    ...state,
    addLine,
    updateLineQty,
    removeLine,
    setExtraQty,
    setPickupWindow,
    submitOrder,
    reorder,
    clearCart,
    totalItems,
    subtotal,
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used inside OrderProvider");
  return ctx;
}

export { ingredientItems };
