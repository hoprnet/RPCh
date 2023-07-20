/* 
  no types available for node's fetch API https://github.com/DefinitelyTyped/DefinitelyTyped/issues/60924#issuecomment-1592958543
  following types taken from https://github.com/DefinitelyTyped/DefinitelyTyped/issues/60924#issuecomment-1563621855
*/

import {
  type FormData as FormDataType,
  type Headers as HeadersType,
  type Request as RequestType,
  type Response as ResponseType,
} from "undici";

declare global {
  // Re-export undici fetch function and various classes to global scope.
  // These are classes and functions expected to be at global scope according to Node.js v18 API
  // documentation.
  // See: https://nodejs.org/dist/latest-v18.x/docs/api/globals.html
  export const {
    FormData,
    Headers,
    Request,
    Response,
    fetch,
  }: typeof import("undici");

  type FormData = FormDataType;
  type Headers = HeadersType;
  type Request = RequestType;
  type Response = ResponseType;
}
