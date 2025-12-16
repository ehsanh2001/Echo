/**
 * Prometheus Registry Singleton
 *
 * Provides a singleton pattern for the Prometheus registry to ensure
 * metrics are only registered once across the application.
 */

import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Summary,
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  SummaryConfiguration,
} from "prom-client";

import { MetricsConfig, DEFAULT_CONFIG } from "./types";

/**
 * Singleton registry instance
 */
let registryInstance: Registry | null = null;
let isInitialized = false;
let currentConfig: MetricsConfig | null = null;

/**
 * Get or create the Prometheus registry
 *
 * @returns The singleton Registry instance
 */
export function getRegistry(): Registry {
  if (!registryInstance) {
    registryInstance = new Registry();
  }
  return registryInstance;
}

/**
 * Initialize the metrics registry with configuration
 *
 * @param config - Metrics configuration
 * @returns The initialized Registry instance
 */
export function initRegistry(config: MetricsConfig): Registry {
  if (isInitialized) {
    console.warn("[Metrics] Registry already initialized, skipping...");
    return getRegistry();
  }

  const registry = getRegistry();
  currentConfig = config;

  // Set default labels
  const defaultLabels: Record<string, string> = {
    service: config.serviceName,
    ...config.customLabels,
  };
  registry.setDefaultLabels(defaultLabels);

  // Collect default Node.js metrics if enabled
  const enableDefaultMetrics =
    config.defaultMetrics ?? DEFAULT_CONFIG.defaultMetrics;
  if (enableDefaultMetrics) {
    const interval =
      config.defaultMetricsInterval ?? DEFAULT_CONFIG.defaultMetricsInterval;
    collectDefaultMetrics({
      register: registry,
      prefix: config.prefix ?? DEFAULT_CONFIG.prefix,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      eventLoopMonitoringPrecision: 10,
    });
    console.log(`[Metrics] Default metrics enabled (interval: ${interval}ms)`);
  }

  isInitialized = true;
  console.log(`[Metrics] Registry initialized for ${config.serviceName}`);

  return registry;
}

/**
 * Check if the registry has been initialized
 */
export function isRegistryInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the current configuration
 */
export function getConfig(): MetricsConfig | null {
  return currentConfig;
}

/**
 * Create a Counter metric
 *
 * @param config - Counter configuration
 * @returns Counter instance
 */
export function createCounter<T extends string>(
  config: CounterConfiguration<T>
): Counter<T> {
  const registry = getRegistry();
  const prefix = currentConfig?.prefix ?? DEFAULT_CONFIG.prefix;

  // Add prefix if not already present
  const name = config.name.startsWith(prefix)
    ? config.name
    : `${prefix}${config.name}`;

  return new Counter({
    ...config,
    name,
    registers: [registry],
  });
}

/**
 * Create a Gauge metric
 *
 * @param config - Gauge configuration
 * @returns Gauge instance
 */
export function createGauge<T extends string>(
  config: GaugeConfiguration<T>
): Gauge<T> {
  const registry = getRegistry();
  const prefix = currentConfig?.prefix ?? DEFAULT_CONFIG.prefix;

  const name = config.name.startsWith(prefix)
    ? config.name
    : `${prefix}${config.name}`;

  return new Gauge({
    ...config,
    name,
    registers: [registry],
  });
}

/**
 * Create a Histogram metric
 *
 * @param config - Histogram configuration
 * @returns Histogram instance
 */
export function createHistogram<T extends string>(
  config: HistogramConfiguration<T>
): Histogram<T> {
  const registry = getRegistry();
  const prefix = currentConfig?.prefix ?? DEFAULT_CONFIG.prefix;

  const name = config.name.startsWith(prefix)
    ? config.name
    : `${prefix}${config.name}`;

  return new Histogram({
    ...config,
    name,
    registers: [registry],
  });
}

/**
 * Create a Summary metric
 *
 * @param config - Summary configuration
 * @returns Summary instance
 */
export function createSummary<T extends string>(
  config: SummaryConfiguration<T>
): Summary<T> {
  const registry = getRegistry();
  const prefix = currentConfig?.prefix ?? DEFAULT_CONFIG.prefix;

  const name = config.name.startsWith(prefix)
    ? config.name
    : `${prefix}${config.name}`;

  return new Summary({
    ...config,
    name,
    registers: [registry],
  });
}

/**
 * Reset the registry (mainly for testing)
 */
export function resetRegistry(): void {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = null;
  isInitialized = false;
  currentConfig = null;
}
