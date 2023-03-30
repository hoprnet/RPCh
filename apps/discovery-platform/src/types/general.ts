/**
 * Types that are going to be used in more than 1 type
 */

export type CamelToSnakeCase<S extends string> =
  S extends `${infer T}${infer U}`
    ? `${T extends Uppercase<T>
        ? "_"
        : ""}${Lowercase<T>}${CamelToSnakeCase<U>}`
    : S;

export type DBTimestamp = {
  created_at: string;
  updated_at: string;
};
