"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Falso no servidor e durante a hidratação; verdadeiro depois. Componentes
 * dentro de um Suspense hidratam mais tarde, quando consultas iniciadas pelo
 * shell (badge, contador) já podem ter dados: ler esses dados antes de hidratar
 * faria o cliente divergir do HTML do servidor.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
