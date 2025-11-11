import * as Toast from "@radix-ui/react-toast";
import { useEffect } from "react";

import { useRunStore } from "../state/useRunStore";

function Toasts() {
  const { toasts, popToast } = useRunStore((state) => ({
    toasts: state.toasts,
    popToast: state.popToast
  }));

  useEffect(() => {
    if (toasts.length) {
      const timer = setTimeout(() => popToast(), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toasts, popToast]);

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          className="m-3 rounded border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-lg"
          open
          onOpenChange={(open) => {
            if (!open) popToast();
          }}
        >
          <Toast.Title className="font-semibold text-slate-50">{toast.title}</Toast.Title>
          {toast.description && (
            <Toast.Description className="text-xs text-slate-400">
              {toast.description}
            </Toast.Description>
          )}
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 flex max-w-sm flex-col gap-2" />
    </Toast.Provider>
  );
}

export default Toasts;
