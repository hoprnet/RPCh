import type * as Prometheus from "prom-client";

/** Overwriting these values will not use specified prefixes */
type OmitNameAndHelp<T> = Omit<T, "name" | "help">;

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
      [key in keyof OmitNameAndHelp<Prometheus.CounterConfiguration<string>>]:
        | Prometheus.CounterConfiguration<string>[key]
        | undefined;
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
    config?: {
      [key in keyof OmitNameAndHelp<Prometheus.GaugeConfiguration<string>>]:
        | Prometheus.GaugeConfiguration<string>[key]
        | undefined;
    }
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
      [key in keyof OmitNameAndHelp<
        Prometheus.HistogramConfiguration<string>
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
    config?: {
      [key in keyof OmitNameAndHelp<Prometheus.SummaryConfiguration<string>>]:
        | Prometheus.SummaryConfiguration<string>[key]
        | undefined;
    }
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
