export type ResultOk<R> = { success: true; res: R };
export type ResultErr = { success: false; error: string };
export type Result<R> = ResultOk<R> | ResultErr;

export function ok<R>(res: R): ResultOk<R> {
    return { success: true, res };
}

export function err(error: string): ResultErr {
    return { success: false, error };
}

export function isOk<R>(res: Result<R>): res is ResultOk<R> {
    return res.success;
}

export function isErr<R>(res: Result<R>): res is ResultErr {
    return !res.success;
}
