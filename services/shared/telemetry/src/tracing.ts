/**
 * OpenTelemetry Tracing Initialization
 *
 * This module sets up distributed tracing with auto-instrumentation.
 * Import this at the VERY TOP of your service entry point:
 *
 * import '@echo/telemetry';
 *
 * Or with custom options:
 *
 * import { initTelemetry } from '@echo/telemetry';
 * initTelemetry({ serviceName: 'my-service' });
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { Resource } from "@opentelemetry/resources";
import {
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  trace,
  context,
} from "@opentelemetry/api";

import { buildConfig, isTelemetryEnabled } from "./config";
import { TelemetryConfig, TelemetryOptions } from "./types";

// Semantic convention attribute names (stable string values)
const ATTR_SERVICE_NAME = "service.name";
const ATTR_SERVICE_VERSION = "service.version";
const ATTR_SERVICE_INSTANCE_ID = "service.instance.id";
const ATTR_DEPLOYMENT_ENVIRONMENT = "deployment.environment";

let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Create a sampler based on configuration
 */
function createSampler(config: TelemetryConfig) {
  const baseSampler =
    config.sampleRatio >= 1.0
      ? new AlwaysOnSampler()
      : new TraceIdRatioBasedSampler(config.sampleRatio);

  // ParentBasedSampler respects parent span's sampling decision
  // This ensures distributed traces are complete
  return new ParentBasedSampler({
    root: baseSampler,
  });
}

/**
 * Create resource attributes for traces
 */
function createResource(config: TelemetryConfig): Resource {
  return new Resource({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    [ATTR_SERVICE_INSTANCE_ID]: config.instanceId,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: config.environment,
  });
}

/**
 * Get auto-instrumentations with appropriate configuration
 */
function getInstrumentations() {
  return [
    // Auto-instrumentation for common libraries
    getNodeAutoInstrumentations({
      // HTTP instrumentation captures Express routes
      "@opentelemetry/instrumentation-http": {
        enabled: true,
        // Ignore health checks and metrics endpoints
        ignoreIncomingRequestHook: (request) => {
          const path = request.url || "";
          return path === "/health" || path === "/ready" || path === "/metrics";
        },
      },
      // Express instrumentation for route names
      "@opentelemetry/instrumentation-express": {
        enabled: true,
      },
      // Redis instrumentation
      "@opentelemetry/instrumentation-ioredis": {
        enabled: true,
      },
      // RabbitMQ instrumentation
      "@opentelemetry/instrumentation-amqplib": {
        enabled: true,
      },
      // Winston logging integration - injects trace_id/span_id into logs
      "@opentelemetry/instrumentation-winston": {
        enabled: true,
      },
      // DNS - can be noisy, disable by default
      "@opentelemetry/instrumentation-dns": {
        enabled: false,
      },
      // File system - can be noisy, disable by default
      "@opentelemetry/instrumentation-fs": {
        enabled: false,
      },
    }),
    // Prisma instrumentation for database queries
    new PrismaInstrumentation(),
  ];
}

/**
 * Initialize OpenTelemetry SDK
 *
 * @param options - Optional configuration overrides
 * @returns The NodeSDK instance
 */
export function initTelemetry(options: TelemetryOptions = {}): NodeSDK | null {
  if (isInitialized) {
    console.warn("[Telemetry] Already initialized, skipping...");
    return sdk;
  }

  if (!isTelemetryEnabled()) {
    console.log(
      "[Telemetry] Disabled (test environment or OTEL_SDK_DISABLED=true)"
    );
    isInitialized = true;
    return null;
  }

  try {
    const config = buildConfig(options);

    // Enable debug logging if requested
    if (config.debug) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    console.log(`[Telemetry] Initializing for ${config.serviceName}`);
    console.log(`[Telemetry] OTLP endpoint: ${config.otlpEndpoint}`);
    console.log(`[Telemetry] Sample ratio: ${config.sampleRatio * 100}%`);
    console.log(`[Telemetry] Instance ID: ${config.instanceId}`);

    // Create OTLP exporter
    const traceExporter = new OTLPTraceExporter({
      url: config.otlpEndpoint,
    });

    // Initialize the SDK
    sdk = new NodeSDK({
      resource: createResource(config),
      traceExporter,
      sampler: createSampler(config),
      instrumentations: getInstrumentations(),
    });

    // Start the SDK
    sdk.start();

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[Telemetry] Shutting down...");
      try {
        await sdk?.shutdown();
        console.log("[Telemetry] Shutdown complete");
      } catch (err) {
        console.error("[Telemetry] Shutdown error:", err);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    isInitialized = true;
    console.log("[Telemetry] Initialized successfully");

    return sdk;
  } catch (error) {
    console.error("[Telemetry] Initialization failed:", error);
    isInitialized = true; // Prevent retry loops
    return null;
  }
}

/**
 * Get the current trace ID from the active span
 * Returns undefined if no active span exists
 */
export function getTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;

  const spanContext = span.spanContext();
  // Only return if trace is valid (not all zeros)
  if (spanContext.traceId === "00000000000000000000000000000000") {
    return undefined;
  }
  return spanContext.traceId;
}

/**
 * Get the current span ID from the active span
 * Returns undefined if no active span exists
 */
export function getSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;

  const spanContext = span.spanContext();
  // Only return if span is valid (not all zeros)
  if (spanContext.spanId === "0000000000000000") {
    return undefined;
  }
  return spanContext.spanId;
}

/**
 * Check if telemetry has been initialized
 */
export function isTelemetryInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the OTel API for manual instrumentation
 * Use this to create custom spans when needed
 *
 * @example
 * const { trace } = getOtelApi();
 * const tracer = trace.getTracer('my-component');
 * const span = tracer.startSpan('custom-operation');
 * try {
 *   // do work
 * } finally {
 *   span.end();
 * }
 */
export function getOtelApi() {
  return { trace, context };
}
