import { decorators } from "@/lib/web/decorator/base.ts";
import { logging } from "@/lib/web/decorator/logging.ts";
import { bundle, localFile, localFiles, routes } from "@/lib/web/route.ts";

import { AuthSession } from "@/app/session.ts";

import * as auth from "@/app/pages/auth.tsx";
import * as business from "@/app/pages/business.tsx";
import * as home from "@/app/pages/home.tsx";
import { RoutesInvoice } from "@/app/pages/invoice/_all.ts";
import * as students from "@/app/pages/students.tsx";

export default decorators([
  logging(),
  AuthSession.decorator(),
])(
  routes([
    ...auth.routes,
    ...home.routes,
    ...business.routes,
    ...students.routes,
    ...RoutesInvoice,
    localFiles(
      "static",
      import.meta.resolve("./static"),
    ),
    localFile(
      "/favicon.ico",
      import.meta.resolve("./static/favicon.ico"),
    ),
    bundle(
      "/shared/",
      import.meta.resolve("./shared"),
    ),
    bundle(
      "/frontend/",
      import.meta.resolve("./frontend"),
    ),
    bundle(
      "/lib/",
      import.meta.resolve("../lib"),
    ),
  ]),
);
