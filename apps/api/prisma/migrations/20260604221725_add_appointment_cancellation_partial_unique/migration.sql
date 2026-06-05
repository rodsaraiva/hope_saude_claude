-- DropIndex
DROP INDEX "Appointment_doctorId_date_key";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Appointment" ADD COLUMN "cancelledBy" TEXT;

-- Índice UNIQUE PARCIAL: impede dois agendamentos ATIVOS no mesmo (médico, data),
-- mas permite reusar o slot quando o anterior está CANCELLED.
-- Gerenciado manualmente (Prisma não expressa índices parciais).
CREATE UNIQUE INDEX "Appointment_doctorId_date_active_key" ON "Appointment"("doctorId", "date") WHERE "status" <> 'CANCELLED';

