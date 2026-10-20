import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorResponse, ApiFieldError, AppError, AppErrorKind } from '../../models/api-error.models';

const NETWORK_MESSAGE = 'We could not reach the server. Check your connection and try again.';
const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';
const VALIDATION_MESSAGE = 'Some of the values are not valid. Please review the form.';
const NOT_FOUND_MESSAGE = 'The requested monthly plan was not found.';
const CONFLICT_MESSAGE = 'A monthly plan already exists for this period.';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isApiFieldError = (value: unknown): value is ApiFieldError =>
  isRecord(value) &&
  typeof value['field'] === 'string' &&
  typeof value['code'] === 'string' &&
  typeof value['message'] === 'string';

export const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  isRecord(value) &&
  typeof value['code'] === 'string' &&
  typeof value['message'] === 'string' &&
  Array.isArray(value['errors']) &&
  value['errors'].every(isApiFieldError);

const kindFromStatus = (status: number): AppErrorKind => {
  if (status === 0) {
    return 'network';
  }
  if (status === 400) {
    return 'validation';
  }
  if (status === 404) {
    return 'not-found';
  }
  if (status === 409) {
    return 'conflict';
  }
  return 'server';
};

const fallbackMessage = (kind: AppErrorKind): string => {
  switch (kind) {
    case 'network':
      return NETWORK_MESSAGE;
    case 'validation':
      return VALIDATION_MESSAGE;
    case 'not-found':
      return NOT_FOUND_MESSAGE;
    case 'conflict':
      return CONFLICT_MESSAGE;
    case 'server':
      return SERVER_MESSAGE;
  }
};

/**
 * Maps any thrown value to one typed `AppError`. Only 400/404/409 envelope messages are surfaced;
 * network and 5xx failures always get a generic message so raw bodies never reach the UI.
 */
export const toAppError = (error: unknown): AppError => {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'server', status: 0, code: 'UNKNOWN_ERROR', message: SERVER_MESSAGE, fieldErrors: [] };
  }

  const kind = kindFromStatus(error.status);
  const envelope = isApiErrorResponse(error.error) ? error.error : null;
  const surfaceEnvelope = envelope !== null && (kind === 'validation' || kind === 'not-found' || kind === 'conflict');

  return {
    kind,
    status: error.status,
    code: envelope?.code ?? (kind === 'network' ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'),
    message: surfaceEnvelope && envelope.message.trim() ? envelope.message : fallbackMessage(kind),
    fieldErrors: kind === 'validation' && envelope ? envelope.errors : []
  };
};
