declare module 'class-validator' {
  export function IsString(): PropertyDecorator;
  export function IsNotEmpty(): PropertyDecorator;
  export function IsOptional(): PropertyDecorator;
  export function IsArray(): PropertyDecorator;
  export function IsNumber(): PropertyDecorator;
  export function IsEnum(entity: object): PropertyDecorator;
  export function IsBoolean(): PropertyDecorator;
}

declare module 'fastify' {
  export interface FastifyRequest {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    params: unknown;
    query: unknown;
  }
}
