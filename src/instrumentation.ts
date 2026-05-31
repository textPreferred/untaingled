import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const apiKey = process.env["HONEYCOMB_API_KEY"];

if (apiKey) {
  const sdk = new NodeSDK({
    serviceName: process.env["OTEL_SERVICE_NAME"] ?? "untaingled",
    traceExporter: new OTLPTraceExporter({
      url: "https://api.honeycomb.io/v1/traces",
      headers: { "x-honeycomb-team": apiKey },
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on("SIGTERM", () => sdk.shutdown());
  process.on("SIGINT", () => sdk.shutdown());
}
