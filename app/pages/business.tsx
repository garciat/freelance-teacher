import z from "zod";

import { Body } from "@/lib/web/body.ts";
import { makePostSchema } from "@/lib/web/forms.tsx";
import { Form } from "@/lib/web/link.tsx";
import { redirect303, Responses } from "@/lib/web/respond.ts";
import { descriptor, formatRoute, route } from "@/lib/web/route.ts";
import { makeToastHeaders } from "@/lib/web/toast/backend.ts";

import { Business } from "@/app/data/business.ts";
import { PageLayout } from "@/app/pages/_layouts/page.tsx";
import { UserExtra } from "@/app/pages/_extra.ts";
import { NonEmptyString } from "@/app/pages/_types.ts";

const UpdateFormSchema = z.object({
  name: NonEmptyString,
  address: NonEmptyString,
  location: NonEmptyString,
  kvk: NonEmptyString,
  vat: NonEmptyString,
  iban: z.iban(),
  bic: NonEmptyString,
});

export const descriptors = {
  index: descriptor("GET", "/business/", {
    response: Responses.jsx,
  }),
  save: descriptor("POST", "/business/", {
    body: Body.formData(makePostSchema(UpdateFormSchema)),
  }),
};

export const routes = [
  route(
    descriptors.index,
    async ({ user }) => {
      const record = await Business.get(user.id);

      return (
        <PageLayout title="Business" user={user}>
          <Form to={descriptors.save}>
            <div className="schema-form">
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={record.name}
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Address</label>
                <input
                  name="address"
                  type="text"
                  defaultValue={record.address}
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Location</label>
                <input
                  name="location"
                  type="text"
                  defaultValue={record.location}
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">KvK Number</label>
                <input
                  name="kvk"
                  type="text"
                  defaultValue={record.kvk}
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">VAT Number</label>
                <input
                  name="vat"
                  type="text"
                  defaultValue={record.vat}
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Bank Account IBAN</label>
                <input
                  name="iban"
                  type="text"
                  defaultValue={record.iban}
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Bank Account BIC</label>
                <input
                  name="bic"
                  type="text"
                  defaultValue={record.bic}
                />
              </div>

              <footer className="actions">
                <button
                  type="submit"
                  name="action"
                  value="save"
                  className="primary"
                >
                  OK
                </button>
                <button
                  type="submit"
                  name="action"
                  value="cancel"
                  formNoValidate
                >
                  Cancel
                </button>
              </footer>
            </div>
          </Form>
        </PageLayout>
      );
    },
    { user: UserExtra.required() },
  ),
  route(
    descriptors.save,
    async ({ body, user }) => {
      if (body.action === "cancel") {
        return redirect303(formatRoute(descriptors.index, {}));
      }

      await Business.set(user.id, body);

      return redirect303(
        formatRoute(descriptors.index, {}),
        makeToastHeaders("✅ Business information updated"),
      );
    },
    { user: UserExtra.required() },
  ),
];
