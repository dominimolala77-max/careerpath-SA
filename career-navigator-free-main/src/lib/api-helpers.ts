/**
 * Shared helpers for TanStack Start server functions.
 *
 * These helpers allow API functions to return typed JSON responses
 * with proper status codes and error handling.
 */

import {
  notFound,
  redirect,
} from "@tanstack/react-router";

/**
 * Create a JSON response from a server function.
 * Usage: return json({ success: true, data: ... });
 */
export function json<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

/**
 * Error response helper.
 */
export function jsonError(message: string, status = 400, code = "ERROR") {
  return json({ success: false, error: message, code }, { status });
}

/**
 * 200 OK response.
 */
export function ok<T>(data: T) {
  return json({ success: true, data });
}

/**
 * 201 Created response.
 */
export function created<T>(data: T) {
  return json({ success: true, data }, { status: 201 });
}

export { notFound, redirect };