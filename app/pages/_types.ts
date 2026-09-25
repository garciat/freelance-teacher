import z from "zod";

export interface UserSession {
  id: string;
  email: string;
}

export const NonEmptyString = z.string().trim().nonempty();
