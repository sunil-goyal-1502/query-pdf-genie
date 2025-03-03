
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add missing import in Index.tsx
// This will be accessible globally
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}
