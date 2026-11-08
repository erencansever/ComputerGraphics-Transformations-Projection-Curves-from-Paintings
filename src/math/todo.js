// Marks functions that still have to be written. The app catches TodoError,
// lists the missing functions on screen and keeps running whatever it can.
export const missing = new Set();

export class TodoError extends Error {
  constructor(name) {
    super(`TODO: implement ${name}`);
    this.fn = name;
  }
}

export function todo(name) {
  missing.add(name);
  throw new TodoError(name);
}
