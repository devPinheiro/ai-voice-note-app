"use client";

import * as React from "react";

interface UseCopyToClipboardProps {
    timeout?: number;
    onCopy?: () => void;
}

export function useCopyToClipboard({ 
    timeout = 2000, 
    onCopy 
}: UseCopyToClipboardProps = {}) {
    const [isCopied, setIsCopied] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout>(null);

    const copyToClipboard = React.useCallback(async (value: string) => {
        if (typeof window === "undefined" || !value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            setIsCopied(true);
            onCopy?.();

            // Clear any existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                setIsCopied(false);
            }, timeout);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }, [timeout, onCopy]);

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return { isCopied, copyToClipboard };
}
