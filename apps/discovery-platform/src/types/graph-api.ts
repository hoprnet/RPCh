export type GetAccountChannelsResponse = {
  data: {
    account: {
      fromChannels: {
        id: string;
        balance: string;
      }[];
    };
  };
};

export type GetAccountsFromBlockChangeResponse = {
  data: {
    account: {
      balance: string;
    };
  }[];
};
