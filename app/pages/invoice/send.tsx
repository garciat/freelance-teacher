import { Buffer } from "node:buffer";

import { Form, Link } from "@/lib/web/link.tsx";
import { redirect303 } from "@/lib/web/respond.ts";
import { formatRoute, route } from "@/lib/web/route.ts";

import { Business, BusinessRecord } from "@/app/data/business.ts";
import { Invoice } from "@/app/data/invoice.ts";
import { Student, StudentRecord } from "@/app/data/student.ts";

import { UserExtra } from "@/app/pages/_extra.ts";
import { PageLayout } from "@/app/pages/_layouts/page.tsx";
import { ResendClient } from "@/app/email.ts";
import { renderToString } from "react-dom/server";
import { PagesInvoice } from "@/app/pages/invoice/_meta.ts";
import { PagesStudent } from "@/app/pages/student/_meta.ts";
import { makeToastHeaders } from "@/lib/web/toast/backend.ts";

export const SENDER = "freelance-teacher@apps.garciat.com";

export const makeSubject = (business: BusinessRecord) =>
  `Your invoice from ${business.name}`;

export const makeRecipient = (student: StudentRecord) =>
  `${student.billing.name} <${student.contact?.email}>`;

export const InvoiceEmail = (
  { business, student }: { business: BusinessRecord; student: StudentRecord },
) => (
  <>
    <p>Dear {student.billing.name},</p>
    <p></p>
    <p>This is your invoice.</p>
    <p></p>
    <p>
      Thank you,<br />
      {business.name}
    </p>
  </>
);

export const RouteInvoiceSend = {
  get: route(
    PagesInvoice.invoice.send.get,
    async ({ path, user }) => {
      const business = await Business.get(user.id);

      const invoice = await Invoice.get(user.id, path.id);

      const student = await Student.get(user.id, invoice.recipient.studentId);

      const email = student.contact?.email;

      if (!email) {
        return (
          <PageLayout title="Invoices" user={user}>
            <p>
              Student{" "}
              <Link
                to={PagesStudent.manage.get}
                path={{ id: student.id }}
                className="navigate"
              >
                {student.name}
              </Link>{" "}
              does not have an e-mail set up.
            </p>
          </PageLayout>
        );
      }

      return (
        <PageLayout title="Invoices" user={user}>
          <p>Please confirm the e-mail contents below.</p>
          <section className="item-details email-preview">
            <div className="item-property">
              <h4>From</h4>
              <p>{SENDER}</p>
            </div>
            <div className="item-property">
              <h4>To</h4>
              <p>{makeRecipient(student)}</p>
            </div>
            <div className="item-property">
              <h4>BCC</h4>
              <p>{user.email}</p>
            </div>
            <div className="item-property">
              <h4>Subject</h4>
              <p>{makeSubject(business)}</p>
            </div>
            <div className="item-property">
              <h4>Body</h4>
              <blockquote>
                <InvoiceEmail business={business} student={student} />
              </blockquote>
            </div>
            <div className="item-property">
              <h4>Attachment</h4>
              <iframe
                src={formatRoute(
                  PagesInvoice.invoice.document,
                  {
                    path: {
                      id: path.id,
                      filename: "preview.pdf",
                    },
                    hash: {
                      "toolbar": "0",
                      "navpanes": "0",
                      "zoom": "page-fit",
                    },
                  },
                )}
              >
              </iframe>
            </div>
          </section>
          <Form to={PagesInvoice.invoice.send.post} path={path}>
            <p className="horizontal-stack">
              <button
                type="submit"
                name="action"
                value="save"
                className="primary"
              >
                Send
              </button>
              <button
                type="submit"
                name="action"
                value="cancel"
              >
                Cancel
              </button>
            </p>
          </Form>
        </PageLayout>
      );
    },
    { user: UserExtra.required() },
  ),

  post: route(
    PagesInvoice.invoice.send.post,
    async ({ path, body, user }) => {
      if (body.action === "cancel") {
        return redirect303(formatRoute(PagesInvoice.index, {}));
      }

      const business = await Business.get(user.id);

      const invoice = await Invoice.get(user.id, path.id);

      const student = await Student.get(user.id, invoice.recipient.studentId);

      if (!student.contact?.email) {
        return new Response("no email", { status: 400 });
      }

      const result = await ResendClient.emails.send({
        from: SENDER,
        to: makeRecipient(student),
        bcc: [user.email],
        subject: makeSubject(business),
        html: renderToString(
          <InvoiceEmail business={business} student={student} />,
        ),
        attachments: [
          {
            content: Buffer.from(invoice.document.invoice),
            filename: `invoice-${invoice.sequenceNumber}.pdf`,
          },
        ],
      });

      if (result.error) {
        throw result.error;
      }

      return redirect303(
        formatRoute(PagesInvoice.index, {}),
        makeToastHeaders(`✅ E-mail sent`),
      );
    },
    { user: UserExtra.required() },
  ),
} as const;
