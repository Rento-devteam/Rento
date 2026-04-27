import { HttpException, HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

function collectFieldMessages(errors: ValidationError[]): Record<string, string> {
  const fields: Record<string, string> = {};
  const walk = (errs: ValidationError[]) => {
    for (const e of errs) {
      if (e.constraints) {
        const first = Object.values(e.constraints)[0];
        if (typeof first === 'string' && first.length > 0) {
          fields[e.property] = first;
        }
      }
      if (e.children?.length) {
        walk(e.children);
      }
    }
  };
  walk(errors);
  return fields;
}

export function createValidationExceptionFactory() {
  return (errors: ValidationError[]) => {
    const fields = collectFieldMessages(errors);
    return new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Проверьте введённые данные',
        fields,
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );
  };
}
