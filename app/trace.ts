import { SpanStatusCode, trace } from "npm:@opentelemetry/api@1";

export const AppTracer = trace.getTracer("freelance-teacher");

export function traced<Args extends unknown[], R>(prefix: string) {
  return <This>(
    originalMethod: (this: This, ...args: Args) => Promise<R>,
    decoratorContext: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Promise<R>
    >,
  ) => {
    if (!decoratorContext.static) {
      throw new TypeError("only static method supported for now");
    }
    if (decoratorContext.private) {
      throw new TypeError("private method not supported");
    }

    const methodName = String(decoratorContext.name);

    return function (this: This & { name: string }, ...args: Args): Promise<R> {
      const spanName = `${prefix}.${this.name}.${methodName}`;

      return AppTracer.startActiveSpan(spanName, async (span) => {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          if (error instanceof Error) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
          } else {
            span.recordException(
              new Error("unknown exception", { cause: error }),
            );
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `exception of unknown type: ${typeof error}`,
            });
          }
          throw error;
        } finally {
          span.end();
        }
      });
    };
  };
}
