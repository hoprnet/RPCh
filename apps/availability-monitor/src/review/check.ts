import retry from "async-retry";
import { createLogger } from "../utils";
// import { REVIEW_TIMEOUT } from "../constants";

const log = createLogger(["review", "check"]);

/**
 * A check's result.
 */
export type CheckResult<T> = {
  checkId: string;
  passed: boolean;
  value?: T;
  error?: string;
};

/**
 * A check used by a review.
 */
export type Check<T, A extends unknown[]> = {
  id: string;
  run: (...args: A) => Promise<CheckResult<T>>;
};

/**
 * Create a check to use in review.
 * @param id
 * @param run
 * @returns a check
 */
export function createCheck<T, A extends unknown[]>(
  id: string,
  run: (...args: A) => Promise<[passed: boolean, value: T]>
): Check<T, A> {
  const check: Check<T, A> = {
    id,
    run: async function RetryRun(...args) {
      const checkResult: CheckResult<T> = {
        checkId: check.id,
        passed: false,
        value: undefined,
        error: undefined,
      };

      try {
        log.verbose("running check %s for %s", check.id);
        const [passed, value] = await retry(
          () => run(...args),
          // () => wrapTimeout(run(...args), REVIEW_TIMEOUT), // REMOVE timeout for debugging
          {
            retries: 2,
            minTimeout: 500,
            maxTimeout: 500,
          }
        );
        checkResult.passed = passed;
        checkResult.value = value;
        return checkResult;
      } catch (error: unknown) {
        checkResult.passed = false;
        checkResult.error =
          error instanceof Error ? error.message : String(error);
        log.verbose(
          "OKAY check error for check ID %s",
          check.id,
          checkResult.error
        );
        return checkResult;
      } finally {
        log.verbose("check finished %s", check.id);
      }
    },
  };
  return check;
}
