// One API process, as selected by the architecture. Events contain no patient data.
export class ClinicUpdates {
  private readonly listeners = new Map<string, Set<() => void>>();
  subscribe(clinicId: string, listener: () => void) {
    const group = this.listeners.get(clinicId) ?? new Set<() => void>();
    group.add(listener);
    this.listeners.set(clinicId, group);
    return () => {
      group.delete(listener);
      if (!group.size) this.listeners.delete(clinicId);
    };
  }
  publish(clinicId: string) {
    for (const listener of this.listeners.get(clinicId) ?? []) listener();
  }
}
