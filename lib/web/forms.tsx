import z from "zod";

export type UIFieldMeta = {
  label: string;
  type: "text" | "number" | "password" | "textarea" | "checkbox" | "select";
  inputMode?: React.HTMLAttributes<"input">["inputMode"];
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export const FormRegistry = z.registry<UIFieldMeta>();

const BasicFormDataSchema = z.record(z.string(), z.string());

type BasicFormData = z.output<typeof BasicFormDataSchema>;

type BasicFormDataSchemaShape = Record<string, z.ZodType<unknown, string>>;

export function makePostSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T> & z.ZodType<unknown, BasicFormData>,
) {
  return z.discriminatedUnion("action", [
    z.object({
      action: z.literal("cancel"),
      _referrer: z.url().optional(),
    }) satisfies z.ZodType<unknown, BasicFormData>,
    schema.extend({
      action: z.literal("save"),
      _referrer: z.url().optional(),
    }), // sadly, can't: satisfies z.ZodType<unknown, BasicFormData>
  ]);
}

export type SchemaBasedFormProps<T extends z.ZodRawShape> = {
  schema: z.ZodObject<T> & z.ZodType<unknown, BasicFormData>;
  value?: z.output<z.ZodObject<T>>;
};

export const SchemaBasedForm = <T extends z.ZodRawShape>({
  schema,
  value,
}: SchemaBasedFormProps<T>) => {
  const fields = generateFormConfig(schema);

  const record = value && schema.encode(value);

  return (
    <div className="schema-form">
      {fields.map((field) => (
        <div key={field.name} className="form-group">
          <label htmlFor={field.name}>
            {field.label}
          </label>
          {renderField(field, record)}
        </div>
      ))}
      <footer className="actions">
        <button type="submit" name="action" value="save" className="primary">
          OK
        </button>
        <button type="submit" name="action" value="cancel" formNoValidate>
          Cancel
        </button>
      </footer>
    </div>
  );
};

interface FormFieldConfig extends UIFieldMeta {
  name: string;
  required: boolean;
}

function generateFormConfig(
  schema: z.ZodObject,
): FormFieldConfig[] {
  return Array.from(function* () {
    for (const [fieldName, fieldSchema] of Object.entries(schema.shape)) {
      const meta = FormRegistry.get(fieldSchema);
      if (!meta) {
        continue;
      }

      const isRequired = !(fieldSchema instanceof z.ZodOptional ||
        fieldSchema instanceof z.ZodNullable);

      yield {
        ...meta,
        name: fieldName,
        required: isRequired,
      };
    }
  }());
}

function renderField(field: FormFieldConfig, record?: Record<string, string>) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          id={field.name}
          name={field.name}
          placeholder={field.placeholder}
          required={field.required}
        >
          {record?.[field.name]}
        </textarea>
      );
    case "select":
      return (
        <select
          id={field.name}
          name={field.name}
          required={field.required}
          defaultValue={record?.[field.name]}
        >
          {field.options?.map((option) => (
            <option value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    default:
      return (
        <input
          id={field.name}
          name={field.name}
          type={field.type}
          inputMode={field.inputMode}
          placeholder={field.placeholder}
          required={field.required}
          defaultChecked={field.type === "checkbox" ? false : undefined}
          defaultValue={record?.[field.name]}
        />
      );
  }
}
