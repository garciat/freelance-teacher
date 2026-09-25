import z from "zod";

import { Body } from "@/lib/web/body.ts";
import { makePostSchema } from "@/lib/web/forms.tsx";
import { Responses } from "@/lib/web/respond.ts";
import { descriptor } from "@/lib/web/route.ts";

import { NonEmptyString } from "@/app/pages/_types.ts";

export const RegisterFormSchema = z.object({
  name: NonEmptyString,
  age_category: z.enum(["adult", "child"]),
  billing_name: NonEmptyString,
  billing_address: NonEmptyString,
  billing_location: NonEmptyString,
  contact_email: z.email(),
  contact_whatsapp: z.string().trim(),
});

export const PagesStudent = {
  index: descriptor("GET", "/students/", {
    response: Responses.jsx,
  }),
  register: {
    get: descriptor("GET", "/students/register", {
      response: Responses.jsx,
    }),
    post: descriptor("POST", "/students/register", {
      body: Body.formData(makePostSchema(RegisterFormSchema)),
    }),
  },
  manage: {
    get: descriptor("GET", "/students/manage/:id", {
      path: z.object({ id: z.uuid() }),
    }),
    post: descriptor("POST", "/students/manage/:id", {
      path: z.object({ id: z.uuid() }),
      body: Body.formData(makePostSchema(RegisterFormSchema)),
    }),
  },
  delete: {
    post: descriptor("POST", "/students/delete/:id", {
      path: z.object({ id: z.uuid() }),
      body: Body.formData(z.object({})),
    }),
  },
};
