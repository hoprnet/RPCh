import Debug from "debug";

const PROJECT_NAMESPACE = "rpch";
const LOG_SEPERATOR = ":";

/**
 * A factory function to generate 'createLogger' function based
 * on the namespace given.
 * @param namespace ex: 'common', 'exit-node'
 * @returns a function to create loggers based on the namespace given
 */
export default function CreateLoggerFactory(namespace: string) {
  const base = Debug([PROJECT_NAMESPACE, namespace].join(LOG_SEPERATOR));
  base.log = console.log.bind(console);

  /**
   * A function to create loggers.
   * @param suffix ex: ['request']
   * @returns three loggers to be used to log things
   */
  return function createLogger(suffix?: string[]) {
    const normal = suffix ? base.extend(suffix.join(LOG_SEPERATOR)) : base;
    const verbose = normal.extend("verbose");
    const error = normal.extend("error");

    return {
      normal,
      verbose,
      error,
    };
  };
}
