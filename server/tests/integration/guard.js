import 'dotenv/config';

// Runs once before the database suites (see vitest.integration.config.js).
// It stops the run when the test database is missing, so a skipped setup can never look like a passing run.
// It also refuses any database whose name lacks "test", because the suites wipe that database first.
export function dbNameFromUri(uri) {
  const withoutQuery = String(uri).split('?')[0];
  const afterHosts = withoutQuery.slice(withoutQuery.indexOf('://') + 3);
  const slash = afterHosts.indexOf('/');
  return slash < 0 ? '' : afterHosts.slice(slash + 1).replace(/\/$/, '');
}

export default function setup() {
  const uri = process.env.MONGODB_URI_TEST;
  if (!uri) {
    throw new Error('MONGODB_URI_TEST is not set. The database tests need a test database, so the run stops here.');
  }
  const name = dbNameFromUri(uri);
  if (!name) {
    throw new Error('MONGODB_URI_TEST must name a database, for example mongodb://127.0.0.1:27017/smart-routine-test.');
  }
  if (!/test/i.test(name)) {
    throw new Error(`MONGODB_URI_TEST must name a database whose name contains "test". Refusing to wipe "${name}".`);
  }
}
