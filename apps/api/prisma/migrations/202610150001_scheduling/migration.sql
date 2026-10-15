CREATE TABLE "SchedulingSettings" (
 "clinicId" uuid PRIMARY KEY REFERENCES "Clinic"(id), revision integer NOT NULL DEFAULT 0,
 "defaultDurationMinutes" integer NOT NULL DEFAULT 30 CHECK("defaultDurationMinutes" BETWEEN 5 AND 480),
 chairs text[] NOT NULL DEFAULT ARRAY['Fauteuil 1','Fauteuil 2','Fauteuil 3','Fauteuil 4']
);
CREATE TABLE "Appointment" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), "patientId" uuid NOT NULL, "dentistId" uuid NOT NULL,
 "chairId" text, "startsAt" timestamptz NOT NULL, "durationMinutes" integer NOT NULL CHECK("durationMinutes" BETWEEN 5 AND 480),
 status text NOT NULL CHECK(status IN ('booked','confirmed','arrived','in_care','completed','cancelled','no_show')),
 "walkIn" boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 0, "cancellationReason" text NOT NULL DEFAULT '',
 UNIQUE("clinicId",id),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id),
 FOREIGN KEY("clinicId","dentistId") REFERENCES "Account"("clinicId",id)
);
CREATE INDEX appointment_agenda ON "Appointment"("clinicId","startsAt");
CREATE TABLE "SchedulingCommand" (
 "clinicId" uuid NOT NULL, "commandId" uuid NOT NULL, "actorId" uuid NOT NULL, "payloadHash" text NOT NULL, receipt jsonb NOT NULL,
 PRIMARY KEY("clinicId","commandId"), FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id)
);
CREATE TABLE "AppointmentHistory" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "appointmentId" uuid NOT NULL, "actorId" uuid NOT NULL, at timestamptz NOT NULL,
 action text NOT NULL, override boolean NOT NULL, appointment jsonb NOT NULL,
 FOREIGN KEY("clinicId","appointmentId") REFERENCES "Appointment"("clinicId",id),
 FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id)
);
CREATE INDEX appointment_history_record ON "AppointmentHistory"("clinicId","appointmentId");
ALTER TABLE "SchedulingSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchedulingSettings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchedulingCommand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchedulingCommand" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentHistory" FORCE ROW LEVEL SECURITY;
CREATE POLICY scheduling_settings_clinic ON "SchedulingSettings" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
CREATE POLICY appointment_clinic ON "Appointment" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
CREATE POLICY scheduling_command_clinic ON "SchedulingCommand" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
CREATE POLICY appointment_history_clinic ON "AppointmentHistory" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT,UPDATE ON "SchedulingSettings","Appointment" TO clinic_runtime;
GRANT SELECT,INSERT ON "SchedulingCommand","AppointmentHistory" TO clinic_runtime;
