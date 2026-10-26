import { useState, type FormHTMLAttributes } from "react";
import { fieldSummary } from "@clinic/contracts";
import { errorMessages as t } from "./error.messages.js";

// Existing scaffold forms retain HTML constraints, with French guidance for all
// invalid fields instead of the browser's language-dependent first-field popup.
export function ValidatedForm({
  children,
  onSubmit,
  onInputCapture,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <form
      {...props}
      noValidate
      onInputCapture={(event) => {
        setErrors([]);
        onInputCapture?.(event);
      }}
      onSubmit={(event) => {
        const invalid = Array.from(event.currentTarget.elements).filter(
          (
            element,
          ): element is
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
            (element instanceof HTMLInputElement ||
              element instanceof HTMLSelectElement ||
              element instanceof HTMLTextAreaElement) &&
            element.willValidate &&
            !element.validity.valid,
        );
        if (invalid.length) {
          event.preventDefault();
          setErrors(
            invalid
              .slice(0, 20)
              .map((field) =>
                fieldSummary({
                  [field.name]: field.validity.valueMissing
                    ? t.required
                    : field.validity.typeMismatch &&
                        field instanceof HTMLInputElement &&
                        field.type === "email"
                      ? t.email
                      : field.validity.tooShort
                        ? t.tooShort((field as HTMLInputElement).minLength)
                        : t.invalid,
                }),
              ),
          );
          invalid[0]?.focus();
          return;
        }
        setErrors([]);
        onSubmit?.(event);
      }}
    >
      {errors.length > 0 && (
        <div role="alert">
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </form>
  );
}
