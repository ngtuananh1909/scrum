import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarUrl(name: string): string {
  const colors = ['c0c1ff', '4ae176', 'ffb4ab', '8083ff', 'ff5451'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${encodeURIComponent(name)}&backgroundColor=${color}`;
}
