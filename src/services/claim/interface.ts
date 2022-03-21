import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface ClaimFreeShareSuccess extends OutcomeSuccess {
  data: {
    success: boolean;
    quantity: number;
    tickerSymbol: string;
    sharePricePaid: number;
  };
}

export interface ClaimService {
  claimFreeShare(user: string): Promise<ClaimFreeShareSuccess | OutcomeFailure>;
}
