export type ResultOk<R> = { success: true; res: R };
export type ResultErr = { success: false; error: string };
export type Result<R> = ResultOk<R> | ResultErr;

export function ok<R>(res: Result<R>): res is ResultOk<R> {
    return res.success;
}

export function err<R>(res: Result<R>): res is ResultErr {
    return !res.success;
}
