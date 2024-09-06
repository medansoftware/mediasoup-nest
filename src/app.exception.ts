import { ValidationError } from '@nestjs/common';

export class ValidationErrorException extends Error {
  constructor(private readonly errors: ValidationError[]) {
    super('ValidationError');
  }

  getErrors() {
    return this.errors;
  }
}
