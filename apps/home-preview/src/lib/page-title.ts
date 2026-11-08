// Routes rendered inside WorkspaceShell. The shell owns their document title
// (screen · research · Margin). React runs child effects before parent effects,
// so the app-level title effect must skip these paths or it overwrites the shell.
export function isWorkspaceShellPath(path: string): boolean {
  return path === "/r" || path === "/account" || path.startsWith("/r/");
}
