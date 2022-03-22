import { z } from "zod";

export const claimFreeShareValidationSchema = z.object({
  user: z.string().min(3),
});
