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

export type getAccountsFromBlockChangeResponse = {
  data: {
    account: {
      balance: string;
    };
  }[];
};
