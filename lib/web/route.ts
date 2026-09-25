import { z } from "zod";
import { eTag, ifNoneMatch, serveDir, serveFile, STATUS_CODE } from "@std/http";
import { HEADER } from "@std/http/unstable-header";
import { join } from "@std/path/join";
import { normalize as posixNormalize } from "@std/path/posix/normalize";

import * as esbuild from "esbuild";

import { MaybeProp } from "@/lib/generic.ts";

import { BaseHandler, Empty, ExtraParser, Handler } from "./types.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const PatternGroupSchema = z.record(
  z.string(),
  z.union([z.string(), z.undefined()]),
);

type PatternGroup = z.output<typeof PatternGroupSchema>;

export type RouteHandler = Handler<Empty, Response | null>;

export type URLPatternMini = { pathname: string; search?: string };

export interface RouteDescriptor<
  M extends HttpMethod = HttpMethod,
  N extends string = string,
  P = undefined,
  Q = undefined,
  B = undefined,
  R = Response,
> {
  method: M;
  pathname: N;
  types: {
    path: z.ZodType<P, PatternGroup>;
    query: z.ZodType<Q, URLSearchParams>;
    body: z.ZodType<B, Request>;
    response: z.ZodType<R, Response>;
  };
}

export function descriptor<
  M extends HttpMethod,
  N extends string,
  P = undefined,
  Q = undefined,
  B = undefined,
  R = Response,
>(
  method: M,
  pathname: N,
  types: {
    path?: z.ZodType<P, PatternGroup>;
    query?: z.ZodType<Q, URLSearchParams>;
    body?: z.ZodType<B, Request>;
    response?: z.ZodType<R, Response>;
  },
): RouteDescriptor<M, N, P, Q, B, R> {
  return {
    method,
    pathname,
    types: {
      path: (types.path ?? IgnorePatternGroupCodec) as z.ZodType<
        P,
        PatternGroup
      >,
      query: (types.query ?? IgnoreSearchParamsCodec) as z.ZodType<
        Q,
        URLSearchParams
      >,
      body: (types.body ?? IgnoreBodyCodec) as z.ZodType<B, Request>,
      response: (types.response ?? z.instanceof(Response)) as z.ZodType<
        R,
        Response
      >,
    },
  };
}

const IgnorePatternGroupCodec = z.codec(
  PatternGroupSchema,
  z.undefined(),
  {
    decode: () => undefined,
    encode: () => ({}),
  },
);

const IgnoreSearchParamsCodec = z.codec(
  z.instanceof(URLSearchParams),
  z.undefined(),
  {
    decode: () => undefined,
    encode: () => new URLSearchParams(),
  },
);

const IgnoreBodyCodec = z.codec(
  z.instanceof(Request),
  z.undefined(),
  {
    decode: () => undefined,
    encode: () => new Request(""),
  },
);

export function formatRoute<P, Q>(
  descriptor: RouteDescriptor<
    HttpMethod,
    string,
    P,
    Q,
    unknown,
    unknown
  >,
  values:
    & {
      hash?: string | URLSearchParams | Record<string, string>;
    }
    & MaybeProp<"path", NoInfer<P>>
    & MaybeProp<"query", NoInfer<Q>>,
): string {
  return formatRouteStrict(
    descriptor,
    values as { path: P; query: Q; hash: typeof values.hash },
  );
}

export function formatRouteStrict<P, Q>(
  descriptor: RouteDescriptor<
    HttpMethod,
    string,
    P,
    Q,
    unknown,
    unknown
  >,
  values: {
    path: P;
    query: Q;
    hash?: string | URLSearchParams | Record<string, string>;
  },
): string {
  const pathParts = descriptor.types.path.encode(values.path);

  const pathname = descriptor.pathname.replaceAll(
    /:([a-z0-9_]+)\b/ig,
    (_match, paramName) => {
      const replacement = pathParts[paramName];
      if (replacement === undefined) {
        throw new Error(`missing replacement for: :${paramName}`);
      }
      return replacement;
    },
  );

  const search = descriptor.types.query.encode(values.query);

  const queryString = search.size > 0 ? `?${search.toString()}` : "";

  return `${pathname}${queryString}${formatHash(values.hash)}`;
}

function formatHash(
  hash: undefined | string | URLSearchParams | Record<string, string>,
) {
  if (typeof hash === "undefined") {
    return "";
  } else if (typeof hash === "string") {
    return hash.length === 0 ? "" : `#${hash}`;
  } else if (hash instanceof URLSearchParams) {
    return hash.size === 0 ? "" : `#${hash.toString()}`;
  } else {
    return formatHash(new URLSearchParams(hash));
  }
}

type RouteParams<P, Q, B> = {
  path: P;
  query: Q;
  body: B;
};

type ExtraParams<E> = {
  [Key in keyof E]: E[Key] extends ExtraParser<infer W> ? W
    : never;
};

export function route<
  M extends HttpMethod,
  N extends string,
  P,
  Q,
  B,
  R,
  Extra extends Record<string, ExtraParser>,
>(
  descriptor: RouteDescriptor<M, N, P, Q, B, R>,
  delegate: Handler<RouteParams<P, Q, B> & ExtraParams<Extra>, NoInfer<R>>,
  extra?: Extra,
): RouteHandler {
  const pattern = new URLPattern({ pathname: descriptor.pathname });

  return async ({ ctx }) => {
    if (ctx.req.method !== descriptor.method) return null;

    const match = pattern.exec(ctx.url);
    if (match === null) return null;

    const extraData = await Promise.all(
      Object.entries(extra ?? {})
        .map(
          async ([key, fn]) => ([key, await fn(ctx)] as [string, unknown]),
        ),
    ).then(
      (entries) => Object.fromEntries(entries) as ExtraParams<Extra>,
    ).catch((err) => {
      if (err instanceof Response) {
        return err;
      }
      throw err;
    });

    if (extraData instanceof Response) {
      return extraData;
    }

    const path = descriptor.types.path.safeDecode(match.pathname.groups);
    if (!path.success) {
      return new Response(
        `invalid path for ${pattern.pathname}\n${z.prettifyError(path.error)}`,
      );
    }

    const query = descriptor.types.query.safeDecode(ctx.url.searchParams);
    if (!query.success) {
      return new Response(
        `invalid query for ${pattern.search}\n${z.prettifyError(query.error)}`,
      );
    }

    const body = await descriptor.types.body.safeDecodeAsync(ctx.req);
    if (!body.success) {
      return new Response(
        `invalid body\n${z.prettifyError(body.error)}`,
      );
    }

    const result = await delegate({
      ctx,
      path: path.data,
      query: query.data,
      body: body.data,
      ...extraData,
    });

    const response = await descriptor.types.response.safeEncodeAsync(result);
    if (!response.success) {
      return new Response(
        `invalid response\n${z.prettifyError(response.error)}`,
      );
    }

    return response.data;
  };
}

export function routes(entries: RouteHandler[]): BaseHandler {
  return async (input) => {
    const { ctx } = input;

    for (const entry of entries) {
      const res = await entry(input);
      if (res) return res;
    }

    return new Response(`no route: ${ctx.req.method} ${ctx.req.url}`, {
      status: 404,
    });
  };
}

export function localFiles(
  urlRoot: string,
  fsRoot: string,
): RouteHandler {
  const actualFsRoot = fsRoot.startsWith("file://")
    ? fsRoot.slice("file://".length)
    : fsRoot;

  return ({ ctx }) => {
    if (ctx.url.pathname.startsWith(`/${urlRoot}`)) {
      return serveDir(ctx.req, { urlRoot, fsRoot: actualFsRoot, quiet: true });
    }
    return null;
  };
}

export function localFile(
  path: string,
  fsPath: string,
): RouteHandler {
  const actualFsPath = fsPath.startsWith("file://")
    ? fsPath.slice("file://".length)
    : fsPath;

  return ({ ctx }) => {
    if (ctx.url.pathname === path) {
      return serveFile(ctx.req, actualFsPath);
    }
    return null;
  };
}

const BUNDLE_CACHE = new Map<
  string,
  {
    // will cache indefinitely if there is no mtime available
    etag: string | undefined;
    script: string;
  }
>();

export function bundle(
  urlRoot: `/${string}/`,
  fsRoot: string,
): RouteHandler {
  const actualFsRoot = fsRoot.startsWith("file://")
    ? fsRoot.slice("file://".length)
    : fsRoot;

  return async ({ ctx }) => {
    const decodedUrl = decodeURIComponent(ctx.url.pathname);
    const normalizedPath = posixNormalize(decodedUrl);

    if (!normalizedPath.startsWith(urlRoot)) {
      return null;
    }

    if (normalizedPath !== decodedUrl) {
      const target = new URL(ctx.url);
      target.pathname = normalizedPath;
      return Response.redirect(target, 301);
    }

    if (!/\.(tsx|ts)$/.test(normalizedPath)) {
      return null;
    }

    const fsPath = join(actualFsRoot, normalizedPath.slice(urlRoot.length));

    const fileInfo = await Deno.stat(fsPath).catch((err) => {
      if (err instanceof Deno.errors.NotFound) {
        return null;
      } else {
        throw err;
      }
    });

    if (fileInfo === null || !fileInfo.isFile) {
      return new Response(null, { status: 404 });
    }

    const etag = await eTag(fileInfo);

    const headers = new Headers({
      [HEADER.ContentType]: "application/javascript",
      [HEADER.ETag]: etag ?? "",
    });

    if (etag) {
      const ifNoneMatchValue = ctx.req.headers.get(HEADER.IfNoneMatch);

      if (!ifNoneMatch(ifNoneMatchValue, etag)) {
        return new Response(null, {
          status: STATUS_CODE.NotModified,
          headers,
        });
      }
    }

    {
      const cache = BUNDLE_CACHE.get(fsPath);
      if (cache && cache.etag === etag) {
        return new Response(cache.script, { headers });
      }
    }

    const result = await esbuild.build({
      plugins: [],
      entryPoints: [fsPath],
      bundle: false,
      format: "esm",
      write: false,
      jsx: "automatic",
    });

    if (result.errors.length) {
      throw new Error(result.errors.map((err) => err.text).join("\n"));
    }

    const script = result.outputFiles?.at(0)?.text;

    if (script === undefined) {
      throw new Error("no script?");
    }

    BUNDLE_CACHE.set(fsPath, { etag, script });

    return new Response(script, { headers });
  };
}
