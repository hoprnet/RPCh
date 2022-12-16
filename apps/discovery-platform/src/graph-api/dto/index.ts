export type GraphHoprResponse = {
  data: {
    account: {
      fromChannels: {
        id: string;
        balance: number;
      }[];
    };
  };
};
