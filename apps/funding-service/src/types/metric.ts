export type RequestDurationMetrics = {
  aggregator: string;
  bucketValues: {
    [key: string]: number;
  };
  buckets: number[];
  hashMap: {
    [key: string]: {
      bucketValues: {
        [key: string]: number;
      };
      count: number;
      labels: {
        method?: string;
        path?: string;
        status: string;
      };
      sum: number;
    };
  };
  help: string;
  labelNames: string[];
  name: string;
  registers: {
    _collectors: any[];
    _defaultLabels: {
      app: string;
    };
    _metrics: {
      [key: string]: RequestDurationMetrics;
    };
  }[];
  upperBounds: number[];
};
