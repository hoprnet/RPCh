export type GetAccountChannelsResponse = {
  data: {
    account: {
      fromChannels: {
        id: string;
        balance: number;
      }[];
    };
  };
};

export type getAccountsFromBlockChangeResponse = {
  data: {
    account: {
      balance: number;
    };
  }[];
};
