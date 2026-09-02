"use client";

import { useCallback, useState } from "react";

interface UseCopyToClipboardProps {
  onCopy?: () => void;
}

const useCopyToClipboard = ({ onCopy }: UseCopyToClipboardProps = {}) => {
  const [isCopied, setIsCopied] = useState(false);


  const copyToClipboard = useCallback(
    async (value: string) => {
      if (typeof window === "undefined" || !value) {
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        setIsCopied(true);
        onCopy?.();

      } catch (error) {
        console.error("Failed to copy:", error);
      }
    },
    [onCopy]
  );


  return { isCopied, copyToClipboard };
};



export default useCopyToClipboard;




export const copyToClipboard = async (
	text: string,
	options?: {
		successMessage?: string
		errorMessage?: string
		onSuccess?: () => void
		onError?: (error: Error) => void
	}
): Promise<boolean> => {
	const { 
		successMessage = 'Copied to clipboard!', 
		errorMessage = 'Failed to copy to clipboard', 
		onSuccess, 
		onError 
	} = options || {}

	try {
		await navigator.clipboard.writeText(text)
		
	
		toast.success(successMessage)
		
		onSuccess?.()
		return true
	} catch (error) {
		console.error('Copy to clipboard failed:', error)
		
		toast.error(errorMessage)
		
		onError?.(error as Error)
		return false
	}
}
