import { z, type ZodError, type ZodSchema } from 'zod';
import { parseWithApiError, type ValidationErrorMapping } from '../../utils/validation';

export interface RequestValidatorConfig<TSchema extends z.ZodTypeAny> {
    schema: TSchema;
    /**
     * Optional error mapping to translate Zod issues into ApiError metadata.
     */
    errorMapping?: ValidationErrorMapping;
    /**
     * Pre-validation transformer. Use to normalise raw inputs before schema parsing.
     */
    preValidate?: (input: unknown) => unknown;
    /**
     * Post-parse transformer. Useful for sanitisation or ISO conversions.
     */
    transform?: (parsed: z.infer<TSchema>) => z.infer<TSchema>;
    /**
     * Optional custom error handler. If provided, the schema is evaluated using safeParse and this
     * handler is invoked with the ZodError to throw a domain-specific ApiError.
     */
    mapError?: (error: ZodError) => never;
}

export const createRequestValidator = <TSchema extends z.ZodTypeAny>({
    schema,
    errorMapping,
    preValidate,
    transform,
    mapError,
}: RequestValidatorConfig<TSchema>) => {
    return (data: unknown): z.infer<TSchema> => {
        const normalised = preValidate ? preValidate(data) : data;
        if (mapError) {
            const result = schema.safeParse(normalised);
            if (!result.success) {
                return mapError(result.error);
            }
            const parsedData = result.data;
            return transform ? transform(parsedData) : parsedData;
        }

        const parsedData = parseWithApiError<z.infer<TSchema>>(schema as ZodSchema<z.infer<TSchema>>, normalised, errorMapping);
        return transform ? transform(parsedData) : parsedData;
    };
};
