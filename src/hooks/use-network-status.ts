import { useRef, useSyncExternalStore } from "react";

interface NetworkInformation extends EventTarget {
  downlink?: number;
  downlinkMax?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

function isShallowEqual(object1: Record<string, string>, object2: Record<string, unknown>) {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
  
    if (keys1.length !== keys2.length) {
      return false;
    }
  
    for (const key of keys1) {
      if (object1[key] !== object2[key]) {
        return false;
      }
    }
  
    return true;
  }
  
const getConnection = () => {
    if (typeof window !== "undefined" && typeof window.navigator !== "undefined") {
     
      const nav = window.navigator as Navigator & {
        connection?: NetworkInformation;
        mozConnection?: NetworkInformation;
        webkitConnection?: NetworkInformation;
      };
      return (
        nav.connection ||
        nav.mozConnection ||
        nav.webkitConnection
      );
    }
    return undefined;
}
const useNetworkStateSubscribe = (callback: EventListenerOrEventListenerObject) => {
    window.addEventListener("online", callback, { passive: true });
    window.addEventListener("offline", callback, { passive: true });

    const connection = getConnection();
  
    if (connection) {
      connection.addEventListener("change", callback, { passive: true });
    }
  
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
  
      if (connection) {
        connection.removeEventListener("change", callback);
      }
    };
  };
  
  const getNetworkStateServerSnapshot = () => {
    throw Error("useNetworkState is a client-only hook");
  };
  
  export function useNetworkState() {
    const cache = useRef({});
  
    const getSnapshot = () => {
      const online = navigator.onLine;
      const connection = getConnection();
  
      const nextState = {
        online,
        downlink: connection?.downlink,
        downlinkMax: connection?.downlinkMax,
        effectiveType: connection?.effectiveType,
        rtt: connection?.rtt,
        saveData: connection?.saveData,
        type: connection?.type,
      };
  
      if (isShallowEqual(cache.current, nextState)) {
        return cache.current;
      } else {
        cache.current = nextState;
        return nextState;
      }
    };
  
    return useSyncExternalStore(
      useNetworkStateSubscribe,
      getSnapshot,
      getNetworkStateServerSnapshot
    );
  }