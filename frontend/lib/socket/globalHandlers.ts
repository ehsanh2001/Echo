/**
 * Global Socket.IO Event Handlers
 * These handlers are registered immediately when the socket connects
 * and persist across the entire application lifecycle.
 *
 * This solves the race condition where events are broadcast before
 * React components mount and register their listeners.
 */

import { Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "./types";
import { getQueryClient } from "@/lib/providers/query-provider";
import {
  updateWorkspaceMemberCache,
  updateChannelMemberCache,
} from "./memberCacheHelpers";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Setup all global event handlers on the socket
 */
export function setupGlobalHandlers(socket: TypedSocket) {
  // Workspace member joined
  socket.on("workspace:member:joined", (data) => {
    const queryClient = getQueryClient();
    if (!queryClient) return;

    updateWorkspaceMemberCache(
      queryClient,
      data.workspaceId,
      data.userId,
      data.user
    );
  });

  // Workspace member left
  socket.on("workspace:member:left", (data) => {
    const queryClient = getQueryClient();
    if (!queryClient) return;

    updateWorkspaceMemberCache(
      queryClient,
      data.workspaceId,
      data.userId,
      null
    );
  });

  // Channel member joined
  socket.on("channel:member:joined", (data) => {
    const queryClient = getQueryClient();
    if (!queryClient) return;

    updateChannelMemberCache(
      queryClient,
      data.workspaceId,
      data.channelId,
      data.userId,
      data.user
    );
  });

  // Channel member left
  socket.on("channel:member:left", (data) => {
    const queryClient = getQueryClient();
    if (!queryClient) return;

    updateChannelMemberCache(
      queryClient,
      data.workspaceId,
      data.channelId,
      data.userId,
      null
    );
  });
}
