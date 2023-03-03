import Prometheus from "prom-client";

export const createCounter = (
  registry: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.CounterConfiguration<string>
) => {
  return new Prometheus.Counter({
    name,
    help,
    registers: [registry],
    ...config,
  });
};

export const createGauge = (
  registry: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.GaugeConfiguration<string>
) => {
  return new Prometheus.Gauge({ name, help, registers: [registry], ...config });
};

export const createHistogram = (
  registry: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.HistogramConfiguration<string>
) => {
  return new Prometheus.Histogram({
    name,
    help,
    registers: [registry],
    ...config,
  });
};

export const createSummary = (
  registry: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.SummaryConfiguration<string>
) => {
  return new Prometheus.Summary({
    name,
    help,
    registers: [registry],
    ...config,
  });
};
