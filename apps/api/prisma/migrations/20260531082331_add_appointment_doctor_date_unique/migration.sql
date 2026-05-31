-- CreateIndex
CREATE UNIQUE INDEX "Appointment_doctorId_date_key" ON "Appointment"("doctorId", "date");
