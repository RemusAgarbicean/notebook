import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn-vue components import this.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
