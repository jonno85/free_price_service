export interface BrokerService {
    // To fetch a list of assets available for trading
    listTradableAssets(): Promise<Array<{ tickerSymbol: string }>>;
  
    // To fetch the latest price for an asset
    getLatestPrice(tickerSymbol: string): Promise<{ sharePrice: number }>;
  
    // To check if the stock market is currently open or closed
    isMarketOpen(): Promise<{ open: boolean; nextOpeningTime: string; nextClosingTime: string }>;
  
    // To purchase a share in our Firm's rewards account.
    // NOTE: this works only while the stock market is open otherwise throws an error.
    // NOTE 2: quantity is an integer, no fractional shares allowed.
    buySharesInRewardsAccount(
      tickerSymbol: string,
      quantity: number
    ): Promise<{ success: boolean; sharePricePaid: number }>;
  
    // To view the shares that are available in the Firm's rewards account
    getRewardsAccountPositions(): Promise<Array<{ tickerSymbol: string; quantity: number; sharePrice: number }>>;
  
    // To move shares from our Firm's rewards account to a user's own account
    moveSharesFromRewardsAccount(
      toAccount: string,
      tickerSymbol: string,
      quantity: number
    ): Promise<{ success: boolean }>;
  }
  