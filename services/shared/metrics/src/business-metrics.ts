/**
 * Business Metrics
 *
 * Provides helpers for creating custom business metrics.
 * Use these to track application-specific events and values.
 */

import { Counter, Gauge, Histogram } from "prom-client";
import { createCounter, createGauge, createHistogram } from "./registry";

/**
 * Pre-defined business metric creators
 * Use these for common Echo-specific metrics
 */

/**
 * Create a counter for tracking user registrations
 */
export function createUserRegistrationsCounter(): Counter<"method"> {
  return createCounter({
    name: "users_registered_total",
    help: "Total number of user registrations",
    labelNames: ["method"], // 'email', 'oauth', etc.
  });
}

/**
 * Create a counter for tracking login attempts
 */
export function createLoginAttemptsCounter(): Counter<"status" | "method"> {
  return createCounter({
    name: "login_attempts_total",
    help: "Total number of login attempts",
    labelNames: ["status", "method"], // status: 'success', 'failure'
  });
}

/**
 * Create a counter for tracking messages sent
 */
export function createMessagesSentCounter(): Counter<"channel_type"> {
  return createCounter({
    name: "messages_sent_total",
    help: "Total number of messages sent",
    labelNames: ["channel_type"], // 'public', 'private', 'dm'
  });
}

/**
 * Create a counter for tracking workspaces created
 */
export function createWorkspacesCreatedCounter(): Counter<string> {
  return createCounter({
    name: "workspaces_created_total",
    help: "Total number of workspaces created",
    labelNames: [],
  });
}

/**
 * Create a counter for tracking channels created
 */
export function createChannelsCreatedCounter(): Counter<"type"> {
  return createCounter({
    name: "channels_created_total",
    help: "Total number of channels created",
    labelNames: ["type"], // 'public', 'private'
  });
}

/**
 * Create a counter for tracking invites sent
 */
export function createInvitesSentCounter(): Counter<"status"> {
  return createCounter({
    name: "invites_sent_total",
    help: "Total number of workspace invites sent",
    labelNames: ["status"], // 'sent', 'accepted', 'expired'
  });
}

/**
 * Create a gauge for tracking active WebSocket connections
 */
export function createWebSocketConnectionsGauge(): Gauge<string> {
  return createGauge({
    name: "websocket_connections_active",
    help: "Number of active WebSocket connections",
    labelNames: [],
  });
}

/**
 * Create a counter for tracking WebSocket events
 */
export function createWebSocketEventsCounter(): Counter<
  "event_type" | "direction"
> {
  return createCounter({
    name: "websocket_events_total",
    help: "Total number of WebSocket events",
    labelNames: ["event_type", "direction"], // direction: 'inbound', 'outbound'
  });
}

/**
 * Create a counter for tracking notifications sent
 */
export function createNotificationsSentCounter(): Counter<"type" | "status"> {
  return createCounter({
    name: "notifications_sent_total",
    help: "Total number of notifications sent",
    labelNames: ["type", "status"], // type: 'email', 'push'; status: 'success', 'failure'
  });
}

/**
 * Create a counter for tracking RabbitMQ messages
 */
export function createRabbitMQMessagesCounter(): Counter<
  "exchange" | "routing_key" | "direction"
> {
  return createCounter({
    name: "rabbitmq_messages_total",
    help: "Total number of RabbitMQ messages",
    labelNames: ["exchange", "routing_key", "direction"], // direction: 'published', 'consumed'
  });
}

/**
 * Create a histogram for tracking RabbitMQ message processing duration
 */
export function createRabbitMQProcessingDuration(): Histogram<"queue"> {
  return createHistogram({
    name: "rabbitmq_message_processing_duration_seconds",
    help: "RabbitMQ message processing duration in seconds",
    labelNames: ["queue"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });
}

/**
 * Create a histogram for tracking database query duration
 */
export function createDatabaseQueryDuration(): Histogram<
  "operation" | "model"
> {
  return createHistogram({
    name: "database_query_duration_seconds",
    help: "Database query duration in seconds",
    labelNames: ["operation", "model"], // operation: 'find', 'create', 'update', 'delete'
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  });
}

/**
 * Create a counter for tracking database queries
 */
export function createDatabaseQueriesCounter(): Counter<
  "operation" | "model" | "success"
> {
  return createCounter({
    name: "database_queries_total",
    help: "Total number of database queries",
    labelNames: ["operation", "model", "success"],
  });
}
