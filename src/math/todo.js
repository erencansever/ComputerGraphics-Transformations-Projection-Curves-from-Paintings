// I started every maths function as a stub that throws TodoError, so the app
// could already run and simply list on screen what I still had to write.
// I kept it because it is still handy when I add new functions.
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
