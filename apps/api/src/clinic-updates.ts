// One API process, as selected by the architecture. Events contain no patient data.
export class ClinicUpdates {
  private readonly listeners = new Map<string, Set<(scope?: string) => void>>();
  subscribe(clinicId: string, listener: (scope?: string) => void) {
    const group =
      this.listeners.get(clinicId) ?? new Set<(scope?: string) => void>();
    group.add(listener);
    this.listeners.set(clinicId, group);
    return () => {
      group.delete(listener);
      if (!group.size) this.listeners.delete(clinicId);
    };
  }
  publish(clinicId: string, scope?: string) {
    for (const listener of this.listeners.get(clinicId) ?? []) listener(scope);
  }
}
