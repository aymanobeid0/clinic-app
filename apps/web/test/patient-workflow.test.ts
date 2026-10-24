import { afterEach, expect, test, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createPatientWorkflow } from '../src/features/patients/patient.workflow.js';

afterEach(() => vi.unstubAllGlobals());

test('registering a patient refreshes patient search and booking choices without rejecting shared phones', async () => {
  const cache = new QueryClient();
  cache.setQueryData(['patients', 'clinic:actor', 'list'], []);
  cache.setQueryData(['scheduling', 'clinic', 'actor', 'choices', ''], {
    patients: [],
  });
  cache.setQueryData(['scheduling', 'clinic', 'actor', 'settings'], {
    defaultDurationMinutes: 30,
  });
  cache.setQueryData(['patient-access', 'clinic:actor', 'candidates'], []);
  const response = {
    patient: { id: 'new-patient' },
    duplicateWarning: true,
    duplicates: [{ id: 'family-member' }],
  };
  vi.stubGlobal('fetch', async () => Response.json(response));
  const result = await createPatientWorkflow(cache).register(
    {
      name: 'Enfant fictif',
      phone: '22112211',
      contactKind: 'guardian',
      contactName: 'Parent fictif',
    },
    'stable-command',
  );
  expect(result).toEqual(response);
  expect(
    cache.getQueryState(['patients', 'clinic:actor', 'list'])?.isInvalidated,
  ).toBe(true);
  expect(
    cache.getQueryState(['scheduling', 'clinic', 'actor', 'settings'])
      ?.isInvalidated,
  ).toBe(false);
  expect(
    cache.getQueryState(['patient-access', 'clinic:actor', 'candidates'])
      ?.isInvalidated,
  ).toBe(false);
  expect(
    cache.getQueryState(['scheduling', 'clinic', 'actor', 'choices', ''])
      ?.isInvalidated,
  ).toBe(true);
  cache.clear();
});
