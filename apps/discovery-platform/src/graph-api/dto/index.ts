export type GetAccountChannelsResponse = {
  data: {
    account: {
      fromChannels: {
        id: string;
        balance: bigint;
      }[];
    };
  };
};

export type getAccountsFromBlockChangeResponse = {
  data: {
    account: {
      balance: bigint;
    };
  }[];
};
