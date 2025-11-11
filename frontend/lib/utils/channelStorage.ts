"use client";

/**
 * Utility functions for managing channel selection in localStorage
 */

const SELECTED_CHANNEL_KEY = "echo_selected_channel";

export function saveSelectedChannel(channelId: string | null): void {
  if (typeof window === "undefined") return;

  if (channelId) {
    localStorage.setItem(SELECTED_CHANNEL_KEY, channelId);
  } else {
    localStorage.removeItem(SELECTED_CHANNEL_KEY);
  }
}

export function loadSelectedChannel(): string | null {
  if (typeof window === "undefined") return null;

  return localStorage.getItem(SELECTED_CHANNEL_KEY);
}

export function clearSelectedChannel(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(SELECTED_CHANNEL_KEY);
}
