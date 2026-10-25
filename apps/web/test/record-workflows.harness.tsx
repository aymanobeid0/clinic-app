// Test-only consumer; never imported by the product application.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAttachments } from '../src/features/attachments/useAttachments.js';
import { useHistoricalRecord } from '../src/features/clinical/useHistoricalRecord.js';
function Consumer() {
  const [patient, setPatient] = useState('first');
  const [outcome, setOutcome] = useState('');
  const attachments = useAttachments('clinic:actor', patient, 'clinical');
  const historical = useHistoricalRecord('clinic:actor', patient);
  return (
    <main>
      <p>Patient : {patient}</p>
      <button onClick={() => setPatient('second')}>Changer de patient</button>
      <button
        onClick={() =>
          void attachments
            .upload({
              file: new Blob(['%PDF-fictional'], { type: 'application/pdf' }),
              name: 'Fictif.pdf',
              classification: 'clinical',
            })
            .then((ok) => setOutcome(ok ? 'uploaded' : 'failed'))
        }
      >
        Téléverser
      </button>
      <button onClick={() => void historical.snapshot.refetch()}>
        Recharger historique
      </button>
      <p role="status">{outcome}</p>
      <p data-testid="attachment-busy">{String(attachments.busy)}</p>
      <p data-testid="attachment-uncertain">{String(attachments.uncertain)}</p>
      {attachments.error && <p role="alert">{attachments.error}</p>}
      {historical.snapshot.error && (
        <p role="alert">{historical.snapshot.error.message}</p>
      )}
      <p data-testid="cutoff">{historical.snapshot.data?.cutoff ?? ''}</p>
    </main>
  );
}
const cache = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cache}>
      <Consumer />
    </QueryClientProvider>
  </StrictMode>,
);
