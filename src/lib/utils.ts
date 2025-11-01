import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { type ComponentType, type ReactElement } from 'react'

/**
 * Combines multiple class names and merges Tailwind CSS classes efficiently
 * @param inputs - Class names to be combined
 * @returns Merged class names string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Creates a type-safe variant object for component props
 * @param variants - Component variants configuration
 * @returns Type-safe variant object
 */
export type VariantProps<T extends ComponentType<unknown>> = T extends ComponentType<infer P>
  ? P
  : never

/**
 * Delays execution for a specified number of milliseconds
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Generates a unique ID for components that need one
 * @returns Unique ID string
 */
export const generateId = () => Math.random().toString(36).substring(2, 9)

/**
 * Checks if a value is a valid React element
 * @param element - Element to check
 * @returns Boolean indicating if the element is a valid React element
 */
export const isValidElement = (element: unknown): element is ReactElement => {
  return (
    element !== null &&
    typeof element === 'object' &&
    'type' in element &&
    'props' in element
  )
} 