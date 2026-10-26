/** An expected application failure whose message is safe to return to the caller. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: "export_scope_changed",
  ) {
    super(message);
    this.name = "AppError";
  }
}
