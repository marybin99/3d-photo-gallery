export const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
