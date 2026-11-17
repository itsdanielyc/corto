import { createHash, randomUUID } from "node:crypto";
import { identifierSchema, type Project } from "../contracts/project";
const MAX_TICKETS = 20;
const LIFETIME_MS = 24 * 60 * 60 * 1000;
const digest = (project: Project) =>
  createHash("sha256").update(JSON.stringify(project)).digest("hex");

/** Main-process-only paths are bound to one immutable project and consumed once. */
export class ExportDestinations {
  private readonly tickets = new Map<
    string,
    { path: string; digest: string; expires: number }
  >();
  constructor(private readonly now: () => number = Date.now) {}
  issue(project: Project, path: string): string {
    for (const [id, ticket] of this.tickets)
      if (ticket.expires <= this.now()) this.tickets.delete(id);
    if (this.tickets.size >= MAX_TICKETS)
      throw new Error(
        "Finish or cancel a queued export before choosing another destination",
      );
    const token = randomUUID();
    this.tickets.set(token, {
      path,
      digest: digest(project),
      expires: this.now() + LIFETIME_MS,
    });
    return token;
  }
  take(token: string, project: Project): string {
    identifierSchema.parse(token);
    const ticket = this.tickets.get(token);
    if (
      !ticket ||
      ticket.expires <= this.now() ||
      ticket.digest !== digest(project)
    )
      throw new Error("Choose a destination for this exact export again");
    this.tickets.delete(token);
    return ticket.path;
  }
  release(token: string): void {
    this.tickets.delete(identifierSchema.parse(token));
  }
  clear(): void {
    this.tickets.clear();
  }
}
