import { Span, SpanOptions, trace } from "npm:@opentelemetry/api@1";

export const AppTracer = trace.getTracer("freelance-teacher");

export function traced<Args extends unknown[], R>(
  prefix: string,
  options: {
    span?: SpanOptions;
    pre?: (span: Span, ...args: Args) => void;
    post?: (span: Span, ret: R, ...args: Args) => void;
  } = {},
) {
  const pre = options.pre ?? (() => {});
  const post = options.post ?? (() => {});

  return <This>(
    originalMethod: (this: This, ...args: Args) => R,
    decoratorContext: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => R
    >,
  ) => {
    if (!decoratorContext.static) {
      throw new TypeError("only static method supported for now");
    }
    if (decoratorContext.private) {
      throw new TypeError("private method not supported");
    }

    const methodName = String(decoratorContext.name);

    return function (this: This & { name: string }, ...args: Args): R {
      const spanName = `${prefix}.${this.name}.${methodName}`;

      return AppTracer.startActiveSpan(spanName, options.span ?? {}, (span) => {
        try {
          pre(span, ...args);
          const ret = originalMethod.apply(this, args);
          post(span, ret, ...args);
          return ret;
        } finally {
          span.end();
        }
      });
    };
  };
}
