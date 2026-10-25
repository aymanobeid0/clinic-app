import {
  attachmentUploadSchema,
  attachmentRemoveSchema,
  type AttachmentClass,
  type AttachmentList,
  type AttachmentRecord,
  type AttachmentVersion,
} from '@clinic/contracts';
import type { z } from 'zod';
import { HttpError, post } from '../identity/identity.api.js';

async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, { signal, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok)
    throw new HttpError(
      response.status,
      data.error ?? 'Pièce jointe indisponible.',
    );
  return data;
}
const base = (patientId: string) =>
  `patients/${encodeURIComponent(patientId)}/attachments`;
export const attachmentApi = {
  list: (
    patientId: string,
    classification: AttachmentClass,
    signal?: AbortSignal,
  ) =>
    read<AttachmentList>(
      `${base(patientId)}?${new URLSearchParams({ classification })}`,
      signal,
    ),
  history: (
    patientId: string,
    id: string,
    classification: AttachmentClass,
    signal?: AbortSignal,
  ) =>
    read<AttachmentRecord>(
      `${base(patientId)}/${encodeURIComponent(id)}/history?${new URLSearchParams({ classification })}`,
      signal,
    ),
  upload(
    patientId: string,
    file: Blob,
    input: z.input<typeof attachmentUploadSchema>,
    id?: string,
  ) {
    const data = attachmentUploadSchema.parse(input);
    const params = new URLSearchParams(
      Object.entries(data)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    return post<AttachmentVersion>(
      `${base(patientId)}${id ? `/${encodeURIComponent(id)}/versions` : ''}?${params}`,
      file,
    );
  },
  remove: (
    patientId: string,
    id: string,
    classification: AttachmentClass,
    data: z.input<typeof attachmentRemoveSchema>,
  ) =>
    post<AttachmentRecord>(
      `${base(patientId)}/${encodeURIComponent(id)}/remove?${new URLSearchParams({ classification })}`,
      attachmentRemoveSchema.parse(data),
    ),
  async content(
    patientId: string,
    id: string,
    revision: number,
    classification: AttachmentClass,
    signal?: AbortSignal,
  ) {
    const response = await fetch(
      `/api/${base(patientId)}/${encodeURIComponent(id)}/versions/${revision}/content?${new URLSearchParams({ classification, output: 'inline' })}`,
      { signal, cache: 'no-store' },
    );
    if (!response.ok) {
      const data = await response.json();
      throw new HttpError(
        response.status,
        data.error ?? 'Pièce jointe indisponible.',
      );
    }
    return response.blob();
  },
};
