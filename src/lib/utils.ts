import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function step25(amount: number): number {
  const remainder = amount % 100;
  const nearestStep = Math.round(remainder / 25) * 25;
  return amount - remainder + (nearestStep === 100 ? 100 : nearestStep);
}

// Rounds UP to the next 0, 25, 50, or 75
export function step25Up(amount: number): number {
  const remainder = amount % 100; // work in the last 2 digits
  const nextStep = Math.ceil(remainder / 25) * 25;
  const rounded = amount - remainder + (nextStep === 100 ? 0 : nextStep);
  // if it exactly hits 100, move to next hundred
  return nextStep === 100 ? amount - remainder + 100 : amount - remainder + nextStep;
}

// Helper to access nested properties safely (e.g., "passenger.name")
export function getNestedValue(obj: any, path: string) {
  return path.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj)
}