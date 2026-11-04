import type { Task } from "./domain";

// A reopened task was already being worked on, so it returns to "doing".
export function toggleDone(status: Task["status"]): Task["status"] {
  return status === "done" ? "doing" : "done";
}
