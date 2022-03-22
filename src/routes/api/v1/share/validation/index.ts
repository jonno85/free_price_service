import { z } from "zod";

export const buyShareValidationSchema = z.object({
  user: z.string().min(3),
  quantity: z.number().min(1),
  tickerSymbol: z.string().min(3),
});
