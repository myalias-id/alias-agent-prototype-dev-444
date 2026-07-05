import { NextResponse } from 'next/server';

export function successResponse<T>(
  data: T,
  status = 200,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json({ status: 'success', data }, { status, headers });
}

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function errorResponse(
  message: string,
  status: number,
  details?: string,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(
    details
      ? { status: 'fail', message, details }
      : { status: 'fail', message },
    { status, headers }
  );
}
