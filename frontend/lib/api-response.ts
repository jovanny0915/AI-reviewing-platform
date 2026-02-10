import { NextResponse } from "next/server";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string; code?: string };

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data } satisfies ApiSuccess<T>, {
    status,
  });
}

export function error(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code } satisfies ApiError,
    { status }
  );
}
