import { Responses } from "@/lib/web/respond.ts";
import { descriptor, route } from "@/lib/web/route.ts";

import { PageLayout } from "@/app/pages/_layouts/page.tsx";
import { UserExtra } from "@/app/pages/_extra.ts";

export const descriptors = {
  index: descriptor("GET", "/", { response: Responses.jsx }),
};

export const routes = [
  route(
    descriptors.index,
    ({ user }) => (
      <PageLayout title="Home" user={user}>
        <p>Welcome, {user.email}</p>
      </PageLayout>
    ),
    { user: UserExtra.required() },
  ),
];
