import { z } from "zod";

export type EnvInput = Record<string, string | undefined>;

export const nonEmptyString = (name: string) =>
  z.string().trim().min(1, `${name} is required`);

export const urlString = (name: string) =>
  nonEmptyString(name).refine(
    (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    `${name} must be a valid URL`
  );

export const commaSeparatedList = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : []
  );
