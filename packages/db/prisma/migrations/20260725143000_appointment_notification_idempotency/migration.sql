-- There were no duplicate keys in local or production at migration authoring
-- time. This unique key turns AppointmentNotification into a durable claim for
-- reminder processing across restarts and blue/green deployments.
CREATE UNIQUE INDEX "AppointmentNotification_appointmentId_type_channel_key"
ON "AppointmentNotification"("appointmentId", "type", "channel");
