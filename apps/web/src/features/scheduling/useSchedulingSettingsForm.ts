import { useForm } from 'react-hook-form';
import type { SchedulingSettings } from '@clinic/contracts';
export function useSchedulingSettingsForm(
  settings: SchedulingSettings,
  onSubmit: (path: string, body: object) => void,
) {
  const f = useForm({
    defaultValues: {
      revision: settings.revision,
      duration: String(settings.defaultDurationMinutes),
      chairs: settings.chairs.join('\n'),
    },
  });
  const submit = f.handleSubmit((v) =>
    onSubmit('/settings', {
      revision: v.revision,
      defaultDurationMinutes: Number(v.duration),
      chairs: v.chairs
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean),
    }),
  );
  return { f, submit };
}
