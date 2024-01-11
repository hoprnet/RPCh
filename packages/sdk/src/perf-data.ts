export enum State {
    Ongoing,
    Success,
    Failure,
}

export type PerfData = {
    latency?: number;
    state: State;
};

export function ongoing() {
    return {
        state: State.Ongoing,
    };
}

export function success(p: PerfData, responseTime: number) {
    p.state = State.Success;
    p.latency = responseTime;
}

export function failure(p: PerfData) {
    p.state = State.Failure;
}

export function isSuccess(p: PerfData): p is {
    state: State.Success;
    latency: number;
    startedAt: number;
} {
    return p.state === State.Success;
}
