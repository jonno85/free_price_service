import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface BuyShareSuccess extends OutcomeSuccess {
  data: {
    success: boolean;
    quantity: number;
    tickerSymbol: string;
    sharePricePaid: number;
  };
}

export interface ShareService {
  buyShare(user: string, quantity: number, tickerSymbol: string): Promise<BuyShareSuccess | OutcomeFailure>;
}
