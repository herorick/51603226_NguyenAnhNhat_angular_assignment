export interface ApiFieldError {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  errors: ApiFieldError[];
}

export type AppErrorKind = 'validation' | 'conflict' | 'not-found' | 'network' | 'server';

export interface AppError {
  kind: AppErrorKind;
  status: number;
  code: string;
  message: string;
  fieldErrors: ApiFieldError[];
}
