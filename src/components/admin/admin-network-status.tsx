"use client";

import { useSyncExternalStore } from "react";
import { Wifi, WifiOff } from "lucide-react";

type NetworkStatusState = {
  isOnline: boolean;
  showReconnected: boolean;
};

let currentState: NetworkStatusState = {
  isOnline: true,
  showReconnected: false,
};

const listeners = new Set<() => void>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function ensureListeners() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  currentState = {
    isOnline: navigator.onLine,
    showReconnected: false,
  };

  window.addEventListener("offline", () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    currentState = { isOnline: false, showReconnected: false };
    notify();
  });

  window.addEventListener("online", () => {
    currentState = { isOnline: true, showReconnected: true };
    notify();

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      currentState = { isOnline: true, showReconnected: false };
      notify();
    }, 3500);
  });
}

function subscribe(callback: () => void) {
  ensureListeners();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): NetworkStatusState {
  return currentState;
}

const serverState: NetworkStatusState = {
  isOnline: true,
  showReconnected: false,
};

function getServerSnapshot(): NetworkStatusState {
  return serverState;
}

export function AdminNetworkStatus() {
  const { isOnline, showReconnected } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="admin-network-status admin-network-status--offline"
        title="Network connection lost. Changes may not be saved."
      >
        <WifiOff size={13} aria-hidden="true" />
        <span className="admin-network-status__label">Offline</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="admin-network-status admin-network-status--online"
      >
        <Wifi size={13} aria-hidden="true" />
        <span className="admin-network-status__label">Connected</span>
      </div>
    );
  }

  return null;
}
