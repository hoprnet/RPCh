import Debug from "debug";

const PROJECT_NAMESPACE = "rpch";
const LOG_SEPERATOR = ":";
const ARE_METRICS_ENABLED = Debug(
  [PROJECT_NAMESPACE, "metrics"].join(LOG_SEPERATOR)
).enabled;

/**
 * A type to help us input
 * known metric data.
 */
type MetricData = {
  id: any;
  ethereumAddress: string;
  peerId: string;
  loggedAt: string;
  [key: string]: any;
};

/**
 * A Metric class, use this
 * as last argument to a log.
 */
class Metric {
  constructor(public readonly data: Partial<MetricData>) {}
  public static create(data: Partial<MetricData>): Metric {
    data.loggedAt = String(+Date.now());
    return new Metric(data);
  }
  public toString(): string {
    return JSON.stringify(this.data);
  }
}

/**
 * A wrapper around a logger which will only
 * conditionally log metric data if metrics
 * are enabled.
 * @param logger
 */
const withMetric = (logger: Debug.Debugger) => {
  return (formatter: any, ...args: any[]) => {
    let logArgs: any[] = [];
    let metrics: Metric[] = [];

    // filter out metric instances from args
    for (const arg of args) {
      if (arg instanceof Metric) {
        metrics.push(arg);
      } else {
        logArgs.push(arg);
      }
    }

    // create a single metric instance
    const metricStr = Metric.create(
      metrics.reduce((result, obj) => {
        return {
          ...result,
          ...obj,
        };
      }, {} as any)
    ).toString();

    if (ARE_METRICS_ENABLED && metricStr.length > 0) {
      logArgs.push(metricStr);
    }

    return logger(formatter, ...logArgs);
  };
};

/**
 * A factory function to generate 'createLogger' function based
 * on the namespace given.
 * @param namespace ex: 'common', 'exit-node'
 * @returns a function to create loggers based on the namespace given
 */
export default function CreateLoggerFactory(namespace: string) {
  const base = Debug(["rpch", namespace].join(LOG_SEPERATOR));

  /**
   * A function to create loggers.
   * @param suffix ex: ['request']
   * @returns three loggers to be used to log things
   */
  return function createLogger(suffix: string[] = []) {
    const normal = base.extend(suffix.join(LOG_SEPERATOR));
    const verbose = normal.extend("verbose");
    const error = normal.extend("error");

    return {
      createMetric: Metric.create,
      normal: withMetric(normal),
      verbose: withMetric(verbose),
      error: withMetric(error),
    };
  };
}
