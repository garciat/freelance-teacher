import { dinero, EUR } from "dinero.js";

import { Form } from "@/lib/web/link.tsx";
import { redirect303 } from "@/lib/web/respond.ts";
import { formatRoute, route } from "@/lib/web/route.ts";

import { Business } from "@/app/data/business.ts";
import { Invoice } from "@/app/data/invoice.ts";
import { Student } from "@/app/data/student.ts";
import { renderInvoiceToBuffer } from "@/app/shared/invoice.tsx";

import { Extras } from "@/app/pages/_extra.ts";
import { PageLayout } from "@/app/pages/_layouts/page.tsx";
import { PagesInvoice } from "@/app/pages/invoice/_meta.ts";
import { makeToastHeaders } from "@/lib/web/toast/backend.ts";

export const RouteInvoiceCreate = {
  get: route(
    PagesInvoice.create.get,
    async ({ user }) => {
      const [students, lastSeqNo] = await Promise.all([
        Student.listAll(user.id),
        Invoice.maxSequenceNumber(user.id),
      ]);

      const nextSeqNo = 1n +
        (lastSeqNo ?? BigInt(Temporal.Now.plainDateISO().year) * 10_000n);

      return (
        <PageLayout title="Invoices" user={user}>
          <Form to={PagesInvoice.create.post}>
            <div className="schema-form">
              <div className="form-group">
                <label htmlFor="sequence_no">Sequence Number</label>
                <input
                  name="sequence_no"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={Number(nextSeqNo)}
                  defaultValue={Number(nextSeqNo)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="student_id">Student</label>
                <select id="student_id" name="student_id">
                  {students.toSorted(
                    (a, b) => a.name.localeCompare(b.name),
                  ).map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="lesson_count">Lesson Count</label>
                <input
                  name="lesson_count"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  defaultValue={10}
                />
              </div>
              <div className="form-group">
                <label htmlFor="hourly_rate">Hourly Rate</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    columnGap: "1em",
                  }}
                >
                  <span>EUR</span>
                  <input
                    name="hourly_rate"
                    type="number"
                    inputMode="decimal"
                    step={0.01}
                    defaultValue={50}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="vat_rate">VAT Rate</label>
                <select name="vat_rate">
                  <option value="21">21%</option>
                  <option value="0">0%</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="deadline_days">Deadline (days)</label>
                <input
                  name="deadline_days"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  defaultValue={7}
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
    { user: Extras.User.required() },
  ),

  post: route(
    PagesInvoice.create.post,
    async ({ body, user }) => {
      if (body.action === "cancel") {
        return redirect303(formatRoute(PagesInvoice.index, {}));
      }

      const [business, student] = await Promise.all([
        Business.get(user.id),
        Student.get(user.id, body.student_id),
      ]);

      const created = Temporal.Now.zonedDateTimeISO();

      const deadline = created.add({ days: body.deadline_days });

      const invoice = await renderInvoiceToBuffer({
        title: `Invoice ${body.sequence_no}`,
        sender: business,
        client: {
          name: student.billing.name,
          address: student.billing.address,
          zipCity: student.billing.location,
        },
        invoiceMeta: {
          number: body.sequence_no.toString(),
          date: created.toPlainDate(),
          dueDate: created
            .add({ days: body.deadline_days })
            .toPlainDate(),
          paymentTerms: body.deadline_days,
        },
        items: [
          {
            description: `Lessen voor ${student.name}`,
            qty: body.lesson_count,
            price: body.hourly_rate.toNumber(),
            vatPct: Number.parseInt(body.vat_rate),
          },
        ],
      });

      await Invoice.create(user.id, {
        sequenceNumber: BigInt(body.sequence_no),
        recipient: {
          studentId: student.id,
        },
        amounts: {
          vat: dinero({ amount: 0n, currency: EUR }),
          preTaxTotal: dinero({ amount: 0n, currency: EUR }),
        },
        conditions: {
          deadline: deadline.toInstant(),
        },
        document: {
          invoice,
        },
      });

      return redirect303(
        formatRoute(PagesInvoice.index, {}),
        makeToastHeaders("✅ New invoice created"),
      );
    },
    { user: Extras.User.required() },
  ),
} as const;
