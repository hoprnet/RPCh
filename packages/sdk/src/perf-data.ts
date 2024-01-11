export enum State {
    Ongoing,
    Success,
    Failure,
}

export type PerfData = {
    startedAt: number;
    latency?: number;
    state: State;
};

export function ongoing() {
    return {
        startedAt: performance.now(),
        state: State.Ongoing,
    };
}

export function success(p: PerfData) {
    p.state = State.Success;
    p.latency = Math.round(performance.now() - p.startedAt);
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
