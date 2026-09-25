import { Form, Link } from "@/lib/web/link.tsx";
import { jsx, redirect303 } from "@/lib/web/respond.ts";
import { formatRoute, route } from "@/lib/web/route.ts";

import { AgeCategory, Student, StudentRecord } from "@/app/data/student.ts";
import { PageLayout } from "@/app/pages/_layouts/page.tsx";
import { UserExtra } from "@/app/pages/_extra.ts";
import { PagesStudent } from "@/app/pages/student/_meta.ts";
import { makeToastHeaders } from "@/lib/web/toast/backend.ts";

// TODO split into app/pages/student/*

const ageCategoryLabels = {
  adult: "Adult",
  child: "Child",
} as const satisfies Record<AgeCategory, string>;

export const routes = [
  route(
    PagesStudent.index,
    async ({ user }) => {
      const items = await Student.listAll(user.id);

      const displayItems = items.toSorted((a, b) =>
        a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
      );

      return (
        <PageLayout title="Students" user={user}>
          <div className="toolbar horizontal-stack">
            <Link to={PagesStudent.register.get} className="pill primary">
              Register New Student
            </Link>
          </div>
          {displayItems.map((student, index) => (
            <article key={index} className="item-details">
              <div className="horizontal-fill">
                <div className="item-property">
                  <h4>Name</h4>
                  <p>{student.name}</p>
                </div>
                <div className="item-property">
                  <h4>Category</h4>
                  <p>{ageCategoryLabels[student.ageCategory]}</p>
                </div>
              </div>
              <div className="horizontal-fill">
                <div className="item-property">
                  <h4>Contact</h4>
                  <div className="horizontal-stack">
                    {student.contact?.email && (
                      <a
                        href={`mailto:${student.contact.email}`}
                        target="_blank"
                        className="pill navigate"
                      >
                        E-mail
                      </a>
                    )}
                    {student.contact?.whatsapp && (
                      <a
                        href={`https://wa.me/${
                          student.contact.whatsapp.replaceAll(/[^\d]/g, "")
                        }`}
                        target="_blank"
                        className="pill navigate"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <div className="item-property">
                  <h4>Actions</h4>
                  <div className="horizontal-stack">
                    <Link
                      to={PagesStudent.manage.get}
                      path={{ id: student.id }}
                      className="pill"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </PageLayout>
      );
    },
    { user: UserExtra.required() },
  ),
  route(
    PagesStudent.register.get,
    ({ user }) => (
      <PageLayout title="Students" user={user}>
        <Form to={PagesStudent.register.post}>
          <StudentEditForm record={undefined} />
        </Form>
      </PageLayout>
    ),
    { user: UserExtra.required() },
  ),
  route(
    PagesStudent.register.post,
    async ({ body, user }) => {
      if (body.action === "cancel") {
        return redirect303(formatRoute(PagesStudent.index, {}));
      }

      await Student.create(user.id, {
        name: body.name,
        ageCategory: body.age_category,
        billing: {
          name: body.billing_name,
          address: body.billing_address,
          location: body.billing_location,
        },
        contact: {
          email: body.contact_email,
          whatsapp: body.contact_whatsapp ?? "",
        },
      });

      return redirect303(
        formatRoute(PagesStudent.index, {}),
        makeToastHeaders("✅ New student registered"),
      );
    },
    { user: UserExtra.required() },
  ),
  route(
    PagesStudent.manage.get,
    async ({ ctx, path, user }) => {
      const record = await Student.get(user.id, path.id);

      return jsx(
        <PageLayout title="Students" user={user}>
          <Form to={PagesStudent.manage.post} path={{ id: path.id }}>
            <input type="hidden" name="_referrer" value={ctx.referrer} />

            <StudentEditForm record={record} />
          </Form>
        </PageLayout>,
      );
    },
    { user: UserExtra.required() },
  ),
  route(
    PagesStudent.manage.post,
    async ({ path, body, user }) => {
      if (body.action === "cancel") {
        return redirect303(
          body._referrer ?? formatRoute(PagesStudent.index, {}),
        );
      }

      await Student.update(
        user.id,
        path.id,
        {
          name: body.name,
          ageCategory: body.age_category,
          billing: {
            name: body.billing_name,
            address: body.billing_address,
            location: body.billing_location,
          },
          contact: {
            email: body.contact_email,
            whatsapp: body.contact_whatsapp ?? "",
          },
        },
      );

      return redirect303(
        body._referrer ?? formatRoute(PagesStudent.index, {}),
        makeToastHeaders("✅ Student information updated"),
      );
    },
    { user: UserExtra.required() },
  ),
  route(
    PagesStudent.delete.post,
    async ({ path, user }) => {
      await Student.remove(user.id, path.id);

      return redirect303(formatRoute(PagesStudent.index, {}));
    },
    { user: UserExtra.required() },
  ),
];

const StudentEditForm = ({ record }: { record: StudentRecord | undefined }) => (
  <div className="schema-form">
    <div className="form-group">
      <label htmlFor="name">Name</label>
      <input
        name="name"
        type="text"
        defaultValue={record?.name}
        placeholder="John Student"
      />
    </div>

    <div className="form-group">
      <label htmlFor="name">Age Cateogry</label>
      <select name="age_category" defaultValue={record?.ageCategory}>
        <option value="adult">Adult</option>
        <option value="child">Child</option>
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="billing_name">Billing Name</label>
      <input
        name="billing_name"
        type="text"
        defaultValue={record?.billing.name}
        placeholder="Mary van Parent"
      />
    </div>

    <div className="form-group">
      <label htmlFor="billing_address">Billing Address</label>
      <input
        name="billing_address"
        type="text"
        defaultValue={record?.billing.address}
        placeholder="Street 420"
      />
    </div>

    <div className="form-group">
      <label htmlFor="billing_location">Billing Location</label>
      <input
        name="billing_location"
        type="text"
        defaultValue={record?.billing.location}
        placeholder="1013BH Amsterdam"
      />
    </div>

    <div className="form-group">
      <label htmlFor="contact_email">Contact E-mail</label>
      <input
        name="contact_email"
        type="email"
        inputMode="email"
        defaultValue={record?.contact?.email}
        placeholder="hello@world.com"
      />
    </div>

    <div className="form-group">
      <label htmlFor="contact_whatsapp">Contact WhatsApp</label>
      <input
        name="contact_whatsapp"
        type="tel"
        inputMode="tel"
        defaultValue={record?.contact?.whatsapp}
        placeholder="+31 612300789"
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
);
