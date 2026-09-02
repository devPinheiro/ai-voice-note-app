import { type RefObject, useEffect } from "react";

type EventType = MouseEvent | TouchEvent;

const useClickAway = (
  ref: RefObject<HTMLElement>,
  onClickAway: (event: EventType) => void
) => {
  useEffect(() => {
    // use Abort Controller
    const controller = new AbortController()
    const eventSignal = controller.signal

    function handler(event: EventType) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickAway(event);
      }
    }
    document.addEventListener("mousedown", handler, { signal: eventSignal });
    document.addEventListener("touchstart", handler, { signal: eventSignal });
    return () => {
        controller.abort()
    };
  }, [ref, onClickAway]);
}

export default useClickAway