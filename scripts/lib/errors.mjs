export class CityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CityError';
    this.code = code;
  }
}

export function fail(code, message) {
  throw new CityError(code, message);
}

export function errorOutput(error) {
  if (error instanceof CityError) {
    return { error: { code: error.code, message: error.message } };
  }
  return {
    error: {
      code: 'FILESYSTEM_ERROR',
      message: 'City state could not be accessed safely. Inspect permissions and restore or repair the local state before retrying.',
    },
  };
}
