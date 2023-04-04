import type * as Prometheus from "prom-client";

export class MetricManager {
  constructor(
    private promClient: typeof Prometheus,
    private register: Prometheus.Registry,
    private appName: string
  ) {}

  public createCounter(
    name: string,
    help: string,
    config?: {
      [key in keyof Omit<
        Prometheus.CounterConfiguration<string>,
        "name" | "help"
      >]: Prometheus.CounterConfiguration<string>[key] | undefined;
    }
  ) {
    return new this.promClient.Counter({
      name: this.appName + "_" + name,
      help,
      registers: [this.register],
      ...config,
    });
  }

  public createGauge(
    name: string,
    help: string,
    config?: Prometheus.GaugeConfiguration<string>
  ) {
    return new this.promClient.Gauge({
      name: this.appName + "_" + name,
      help,
      registers: [this.register],
      ...config,
    });
  }

  public createHistogram(
    name: string,
    help: string,
    config?: {
      [key in keyof Omit<
        Prometheus.HistogramConfiguration<string>,
        "name" | "help"
      >]: Prometheus.HistogramConfiguration<string>[key] | undefined;
    }
  ) {
    return new this.promClient.Histogram({
      name: this.appName + "_" + name,
      help,
      registers: [this.register],
      ...config,
    });
  }

  public createSummary(
    name: string,
    help: string,
    config?: Prometheus.SummaryConfiguration<string>
  ) {
    return new this.promClient.Summary({
      name: this.appName + "_" + name,
      help,
      registers: [this.register],
      ...config,
    });
  }

  public async getMetrics() {
    return await this.register.metrics();
  }
}
