export function localAdminIsConfigured() {
  return Boolean(process.env.ADMIN_LOCAL_TOKEN);
}

export function hasLocalAdminAccess(request: Request) {
  const expected = process.env.ADMIN_LOCAL_TOKEN;
  return Boolean(expected) && request.headers.get("x-admin-local-token") === expected;
}
