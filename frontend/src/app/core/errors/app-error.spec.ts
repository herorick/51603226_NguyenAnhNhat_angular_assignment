import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { ApiErrorResponse, AppErrorKind } from '../../models/api-error.models';
import {
  DUPLICATE_PLAN_ERROR_FIXTURE,
  INTERNAL_ERROR_FIXTURE,
  NOT_FOUND_ERROR_FIXTURE,
  VALIDATION_ERROR_FIXTURE
} from '../../testing/fixtures';
import { isApiErrorResponse, toAppError } from './app-error';

const FALLBACK_MESSAGE: Record<AppErrorKind, string> = {
  network: 'We could not reach the server. Check your connection and try again.',
  validation: 'Some of the values are not valid. Please review the form.',
  'not-found': 'The requested monthly plan was not found.',
  conflict: 'A monthly plan already exists for this period.',
  server: 'Something went wrong on our side. Please try again.'
};

const httpError = (status: number, body: unknown): HttpErrorResponse =>
  new HttpErrorResponse({ status, statusText: `HTTP ${status}`, error: body });

describe('isApiErrorResponse', () => {
  it('accepts a full envelope with no field errors', () => {
    expect(isApiErrorResponse(DUPLICATE_PLAN_ERROR_FIXTURE)).toBe(true);
  });

  it('accepts an envelope with field errors', () => {
    expect(isApiErrorResponse(VALIDATION_ERROR_FIXTURE)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Internal Server Error'],
    ['a number', 500],
    ['an array', []],
    ['an empty object', {}],
    ['missing code', { message: 'm', errors: [] }],
    ['missing message', { code: 'C', errors: [] }],
    ['missing errors', { code: 'C', message: 'm' }],
    ['non-string code', { code: 1, message: 'm', errors: [] }],
    ['non-string message', { code: 'C', message: 1, errors: [] }],
    ['errors that is not an array', { code: 'C', message: 'm', errors: 'x' }],
    ['a field error without field', { code: 'C', message: 'm', errors: [{ code: 'X', message: 'y' }] }],
    ['a field error without code', { code: 'C', message: 'm', errors: [{ field: 'f', message: 'y' }] }],
    ['a field error without message', { code: 'C', message: 'm', errors: [{ field: 'f', code: 'X' }] }],
    ['a null field error', { code: 'C', message: 'm', errors: [null] }]
  ])('rejects %s', (_label, value) => {
    expect(isApiErrorResponse(value)).toBe(false);
  });
});

describe('toAppError', () => {
  describe('network failures (status 0)', () => {
    it('maps a status 0 response to a network error with the generic message', () => {
      const error = toAppError(
        new HttpErrorResponse({ status: 0, statusText: 'Unknown Error', error: new ProgressEvent('error') })
      );

      expect(error).toEqual({
        kind: 'network',
        status: 0,
        code: 'NETWORK_ERROR',
        message: FALLBACK_MESSAGE.network,
        fieldErrors: []
      });
    });

    it('never surfaces an envelope message on a network error', () => {
      const error = toAppError(httpError(0, INTERNAL_ERROR_FIXTURE));

      expect(error.kind).toBe('network');
      expect(error.message).toBe(FALLBACK_MESSAGE.network);
      expect(error.fieldErrors).toEqual([]);
    });
  });

  describe('400 validation', () => {
    it('keeps the envelope message, code and field errors', () => {
      const error = toAppError(httpError(400, VALIDATION_ERROR_FIXTURE));

      expect(error).toEqual({
        kind: 'validation',
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'One or more fields are invalid.',
        fieldErrors: VALIDATION_ERROR_FIXTURE.errors
      });
    });

    it('uses the validation fallback and no field errors when the body is not an envelope', () => {
      const error = toAppError(httpError(400, 'Bad Request'));

      expect(error).toEqual({
        kind: 'validation',
        status: 400,
        code: 'UNKNOWN_ERROR',
        message: FALLBACK_MESSAGE.validation,
        fieldErrors: []
      });
    });
  });

  describe('404 not found', () => {
    it('surfaces the envelope message and code', () => {
      const error = toAppError(httpError(404, NOT_FOUND_ERROR_FIXTURE));

      expect(error).toEqual({
        kind: 'not-found',
        status: 404,
        code: 'MONTHLY_PLAN_NOT_FOUND',
        message: 'No monthly plan exists for 2026-09.',
        fieldErrors: []
      });
    });

    it('ignores field errors that are not part of a validation failure', () => {
      const body: ApiErrorResponse = { ...NOT_FOUND_ERROR_FIXTURE, errors: VALIDATION_ERROR_FIXTURE.errors };

      expect(toAppError(httpError(404, body)).fieldErrors).toEqual([]);
    });
  });

  describe('409 conflict', () => {
    it('surfaces the envelope message and code', () => {
      const error = toAppError(httpError(409, DUPLICATE_PLAN_ERROR_FIXTURE));

      expect(error).toEqual({
        kind: 'conflict',
        status: 409,
        code: 'MONTHLY_PLAN_ALREADY_EXISTS',
        message: 'A monthly plan already exists for 2026-09.',
        fieldErrors: []
      });
    });
  });

  describe('5xx server errors', () => {
    it.each([500, 502, 503])('uses the generic message for %i and never surfaces the raw body message', (status) => {
      const error = toAppError(httpError(status, INTERNAL_ERROR_FIXTURE));

      expect(error.kind).toBe('server');
      expect(error.status).toBe(status);
      expect(error.message).toBe(FALLBACK_MESSAGE.server);
      expect(error.message).not.toContain(INTERNAL_ERROR_FIXTURE.message);
      expect(error.fieldErrors).toEqual([]);
    });

    it('does not leak field errors from a 500 envelope', () => {
      const error = toAppError(httpError(500, VALIDATION_ERROR_FIXTURE));

      expect(error.kind).toBe('server');
      expect(error.message).toBe(FALLBACK_MESSAGE.server);
      expect(error.fieldErrors).toEqual([]);
    });

    it('treats other non-listed statuses (for example 401, 418) as server errors', () => {
      expect(toAppError(httpError(401, null)).kind).toBe('server');
      expect(toAppError(httpError(418, null)).kind).toBe('server');
    });
  });

  describe('bodies that are not an API envelope', () => {
    const cases: [number, AppErrorKind][] = [
      [400, 'validation'],
      [404, 'not-found'],
      [409, 'conflict'],
      [500, 'server']
    ];
    const bodies: [string, unknown][] = [
      ['a string', '<html>Bad gateway</html>'],
      ['null', null],
      ['an object missing fields', { message: 'Only a message' }],
      ['an envelope with a malformed field error', { code: 'C', message: 'm', errors: [{ field: 'x' }] }]
    ];

    for (const [status, kind] of cases) {
      it.each(bodies)(`falls back to the ${kind} message for ${status} with %s`, (_label, body) => {
        const error = toAppError(httpError(status, body));

        expect(error).toEqual({
          kind,
          status,
          code: 'UNKNOWN_ERROR',
          message: FALLBACK_MESSAGE[kind],
          fieldErrors: []
        });
      });
    }
  });

  describe('blank envelope message', () => {
    it.each([
      [400, 'validation' as const],
      [404, 'not-found' as const],
      [409, 'conflict' as const]
    ])('falls back to the kind message for %i but keeps the envelope code', (status, kind) => {
      const body: ApiErrorResponse = { code: 'SOME_CODE', message: '   ', errors: [] };

      const error = toAppError(httpError(status, body));

      expect(error.kind).toBe(kind);
      expect(error.code).toBe('SOME_CODE');
      expect(error.message).toBe(FALLBACK_MESSAGE[kind]);
    });

    it('also treats an empty string message as blank', () => {
      const body: ApiErrorResponse = { code: 'MONTHLY_PLAN_ALREADY_EXISTS', message: '', errors: [] };

      expect(toAppError(httpError(409, body)).message).toBe(FALLBACK_MESSAGE.conflict);
    });
  });

  describe('values that are not an HttpErrorResponse', () => {
    it.each<[string, unknown]>([
      ['an Error', new Error('boom: internal detail')],
      ['a string', 'boom'],
      ['null', null],
      ['undefined', undefined],
      ['a plain object that looks like a response', { status: 409, error: DUPLICATE_PLAN_ERROR_FIXTURE }]
    ])('maps %s to a server UNKNOWN_ERROR with the generic message', (_label, thrown) => {
      expect(toAppError(thrown)).toEqual({
        kind: 'server',
        status: 0,
        code: 'UNKNOWN_ERROR',
        message: FALLBACK_MESSAGE.server,
        fieldErrors: []
      });
    });
  });
});
