import { formatRoute } from "@/lib/web/route.ts";

import { BaseLayout, BaseLayoutProps } from "@/app/pages/_layouts/base.tsx";
import { UserSession } from "@/app/pages/_types.ts";
import { PagesHome } from "@/app/pages/home.tsx";

export type PageLayoutProps = BaseLayoutProps & {
  user?: UserSession;
};

const nav = [
  {
    label: "Home",
    href: formatRoute(PagesHome.index, {}),
    kind: "user" as const,
  },
  { label: "Business", href: "/business/", kind: "user" as const },
  { label: "Students", href: "/students/", kind: "user" as const },
  { label: "Invoices", href: "/invoices/", kind: "user" as const },
  { label: "Logout", href: "/auth/logout", kind: "user" as const },
  { label: "Login", href: "/auth/login", kind: "anon" as const },
];

function isVisible(
  user: UserSession | undefined,
  kind: "all" | "user" | "anon",
): boolean {
  switch (kind) {
    case "all":
      return true;
    case "user":
      return Boolean(user);
    case "anon":
      return !user;
  }
}

export const PageLayout: React.FC<PageLayoutProps> = (
  { title, user, children },
) => (
  <BaseLayout title={title}>
    <main>
      <header className="site-navigation">
        <div className="wrapper">
          <h1>
            <span className="icon">🧑‍🏫</span>
            <span className="text">{title}</span>
          </h1>
          <button
            type="button"
            className="menu-toggle"
            popoverTarget="mobile-menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="menu-icon"
            >
              <line x1="2" y1="12" x2="22" y2="12" className="line-top" />
              <line x1="2" y1="12" x2="22" y2="12" className="line-bottom" />
            </svg>
          </button>
          <nav id="mobile-menu" popover="">
            <ul>
              {nav.map((item) =>
                isVisible(user, item.kind) && (
                  <li key={item.href}>
                    <a href={item.href}>
                      <span>{item.label}</span>
                    </a>
                  </li>
                )
              )}
            </ul>
          </nav>
        </div>
      </header>
      <div className="content">
        {children}
      </div>
    </main>
  </BaseLayout>
);
