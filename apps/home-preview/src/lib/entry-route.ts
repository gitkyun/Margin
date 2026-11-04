const HOME_PATH = /^\/(r\/[^/]+\/?)?$/;

// Decides whether the screen being loaded is the research home, so the
// loading state can mirror its layout. On the login page the destination is
// the `next` parameter, which defaults to the start path.
export function isHomeEntry(pathname: string, search: string): boolean {
  if (pathname !== "/login") return HOME_PATH.test(pathname);
  const next = new URLSearchParams(search).get("next") ?? "/";
  return HOME_PATH.test(next.split(/[?#]/)[0]);
}
