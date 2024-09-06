import { ValidationPipeOptions } from '@nestjs/common';
import { ValidationErrorException } from './app.exception';
import { AppConfig, AppEnv } from './app.type';

export const DEFAULT_VALIDATION_OPTIONS: ValidationPipeOptions = {
  transform: true,

  // If set to true, validator will print extra warning messages
  // to the console when something is not right.
  enableDebugMessages: true,

  // If set to true then validator will skip validation
  // of all properties that are undefined in the validating object.
  skipUndefinedProperties: false,

  // If set to true then validator will skip validation
  // of all properties that are null in the validating object.
  skipNullProperties: false,

  // If set to true then validator will skip validation
  // of all properties that are null or undefined in the validating object.
  skipMissingProperties: false,

  // If set to true, validator will strip validated (returned) object
  // of any properties that do not use any validation decorators.
  whitelist: false,

  // If set to true, instead of stripping non-whitelisted properties
  // validator will throw an exception.
  forbidNonWhitelisted: false,

  // If set to true, attempts to validate unknown objects fail immediately.
  // IMPORTANT The forbidUnknownValues value is set to true by default and it is highly advised to keep the default.
  // Setting it to false will result unknown objects passing the validation!
  forbidUnknownValues: true,

  // If set to true, validation errors will not be returned to the client.
  disableErrorMessages: false,

  // This setting allows you to specify which exception type will be used in case of an error. By default it throws BadRequestException.
  // errorHttpStatusCode: 400,

  // Takes an array of the validation errors and returns an exception object to be thrown.
  exceptionFactory: (errors) => {
    return new ValidationErrorException(
      errors.map(({ property, children, value, contexts, constraints }) => ({
        property,
        children,
        value,
        contexts,
        message: Object.keys(constraints)[0],
      })),
    );
  },

  // Groups to be used during validation of the object.
  groups: [],

  // Set default for always option of decorators.
  // Default can be overridden in decorator options
  always: false,

  // If groups is not given or is empty, ignore decorators with at least one group.
  strictGroups: false,

  // If set to true, the validation will not use default messages.
  // Error message always will be undefined if its not explicitly set.
  dismissDefaultMessages: false,

  validationError: {
    // Indicates if target should be exposed in ValidationError
    target: false,
    // Indicates if validated value should be exposed in ValidationError.
    value: true,
  },

  // When set to true, validation of the given property will stop
  // after encountering the first error. Defaults to false.
  stopAtFirstError: true,
};

const config: AppConfig = {
  environment: (process.env.NODE_ENV as AppEnv) || 'production',
};

export default () => config;
