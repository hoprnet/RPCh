/* Common Types */

export type JSONObject =
  | any
  | string
  | number
  | boolean
  | { [x: string]: JSONObject }
  | Array<JSONObject>;
