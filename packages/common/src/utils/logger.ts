import Debug from "debug";

const LOG_SEPERATOR = ":";
const ARE_METRICS_ENABLED = Debug("metric").enabled;

/**
 * A type to help us input
 * known metric data.
 */
type MetricData = {
  id: any;
  ethereumAddress: string;
  peerId: string;
  [key: string]: any;
};

/**
 * A Metric class, use this
 * as last argument to a log.
 */
class Metric {
  constructor(public readonly data: Partial<MetricData>) {}
  public static create(data: Partial<MetricData>): Metric {
    return new Metric(data);
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
    if (!ARE_METRICS_ENABLED) return logger(formatter, ...args);

    let metricInstance: Metric | undefined;
    if (
      ARE_METRICS_ENABLED &&
      args.length > 0 &&
      args[args.length - 1] instanceof Metric
    ) {
      metricInstance = args.pop();
    }

    return logger(
      formatter,
      ...args,
      metricInstance ? metricInstance.data : undefined
    );
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
