import { MaybeProp } from "@/lib/generic.ts";
import { formatRouteStrict, RouteDescriptor } from "@/lib/web/route.ts";

type LinkProps<P, Q> =
  & {
    to: RouteDescriptor<"GET", string, P, Q, unknown, unknown>;
  }
  & MaybeProp<"path", NoInfer<P>>
  & MaybeProp<"query", NoInfer<Q>>
  & Omit<React.ComponentPropsWithoutRef<"a">, "href">;

export const Link = <P, Q>(
  { to, path, query, ...anchorProps }: LinkProps<P, Q>,
) => <a href={formatRouteStrict(to, { path, query })} {...anchorProps} />;

type FormProps<P, Q> =
  & {
    to: RouteDescriptor<"GET" | "POST", string, P, Q, unknown, unknown>;
  }
  & MaybeProp<"path", NoInfer<P>>
  & MaybeProp<"query", NoInfer<Q>>
  & Omit<React.ComponentPropsWithoutRef<"form">, "method" | "action">;

export const Form = <P, Q>(
  { to, path, query, ...anchorProps }: FormProps<P, Q>,
) => (
  <form
    method={to.method}
    action={formatRouteStrict(to, { path, query })}
    {...anchorProps}
  />
);
