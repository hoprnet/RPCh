import Prometheus from "prom-client";

export const createCounter = (
  register: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.CounterConfiguration<string>
) => {
  return new Prometheus.Counter({
    name,
    help,
    registers: [register],
    ...config,
  });
};

export const createGauge = (
  register: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.GaugeConfiguration<string>
) => {
  return new Prometheus.Gauge({ name, help, registers: [register], ...config });
};

export const createHistogram = (
  register: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.HistogramConfiguration<string>
) => {
  return new Prometheus.Histogram({
    name,
    help,
    registers: [register],
    ...config,
  });
};

export const createSummary = (
  register: Prometheus.Registry,
  name: string,
  help: string,
  config?: Prometheus.SummaryConfiguration<string>
) => {
  return new Prometheus.Summary({
    name,
    help,
    registers: [register],
    ...config,
  });
};
