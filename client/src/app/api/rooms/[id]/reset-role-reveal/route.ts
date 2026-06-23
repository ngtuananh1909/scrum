import { NextResponse } from 'next/server';

// No-op endpoint kept for client compatibility.
// Role-reveal close is purely client-side state (Zustand `showRoleReveal`).
// Previous implementation wrote to a non-existent `rooms.roleReveal` column.
export async function POST() {
  return NextResponse.json({ success: true });
}
