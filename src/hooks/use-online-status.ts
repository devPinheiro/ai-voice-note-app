import { useEffect, useState } from "react";

const useOnlineStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    // use abortcontroller to manage event listeners
    const abortController = new AbortController()
    const eventSignal = abortController.signal
    
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update, {signal: eventSignal});
    window.addEventListener("offline", update, {signal: eventSignal});
    
    // clean up events after component unmounts
    return () => {
      abortController.abort()
    };
  }, []);
  
  return online;
}

export default useOnlineStatus