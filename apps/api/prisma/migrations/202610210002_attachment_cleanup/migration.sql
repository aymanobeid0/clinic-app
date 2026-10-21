-- Keep a cancelled key until its writer acknowledges failure. A delayed writer
-- can still create an object after an expired lease has been reaped; retaining
-- its tombstone lets later uploads find/discard it even after a process crash.
ALTER TABLE "AttachmentReservation" ADD COLUMN cancelled boolean NOT NULL DEFAULT false;
ALTER TABLE "AttachmentReservation" DROP CONSTRAINT "AttachmentReservation_clinicId_commandId_key";
CREATE UNIQUE INDEX "AttachmentReservation_active_command" ON "AttachmentReservation"("clinicId","commandId") WHERE NOT cancelled;
CREATE INDEX ON "AttachmentReservation"("clinicId","commandId");
GRANT UPDATE ON "AttachmentReservation" TO clinic_runtime;
