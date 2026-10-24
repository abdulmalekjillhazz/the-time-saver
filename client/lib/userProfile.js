export function requireUserProfile(payload) {
  const user = payload?.user;
  if (
    !user
    || typeof user !== 'object'
    || Array.isArray(user)
    || typeof user.id !== 'string'
    || typeof user.displayName !== 'string'
  ) {
    const error = new Error('The server did not return a valid user profile.');
    error.code = 'INVALID_USER_RESPONSE';
    error.status = 200;
    throw error;
  }

  return user;
}
