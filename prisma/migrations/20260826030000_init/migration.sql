-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('hr', 'branch_head', 'admin');

-- CreateEnum
CREATE TYPE "period_status" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "period_event_type" AS ENUM ('submitted', 'approved', 'rejected', 'reopened');

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "default_city_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "branch_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_branch_role_check" CHECK (
        (role = 'branch_head' AND branch_id IS NOT NULL)
        OR (role <> 'branch_head' AND branch_id IS NULL)
    )
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_rates" (
    "id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "price_per_liter" INTEGER NOT NULL,
    "km_per_liter" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_periods" (
    "id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "status" "period_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_periods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expense_periods_month_check" CHECK (period_month >= 1 AND period_month <= 12)
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "trip_date" DATE NOT NULL,
    "city_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "odo_start" INTEGER NOT NULL,
    "odo_end" INTEGER NOT NULL,
    "distance_km" INTEGER GENERATED ALWAYS AS (odo_end - odo_start) STORED NOT NULL,
    "fuel_price_per_liter" INTEGER NOT NULL,
    "fuel_km_per_liter" DECIMAL(5,2) NOT NULL,
    "fuel_cost" INTEGER NOT NULL,
    "toll_amount" INTEGER NOT NULL DEFAULT 0,
    "parking_amount" INTEGER NOT NULL DEFAULT 0,
    "meal_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER GENERATED ALWAYS AS (fuel_cost + toll_amount + parking_amount + meal_amount) STORED NOT NULL,
    "notes" TEXT,
    "odo_gap_flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trips_odo_check" CHECK (odo_end > odo_start),
    CONSTRAINT "trips_amounts_check" CHECK (toll_amount >= 0 AND parking_amount >= 0 AND meal_amount >= 0)
);

-- CreateTable
CREATE TABLE "period_events" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "event_type" "period_event_type" NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_lower_key" ON "cities" (lower("name"));

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_code_key" ON "technicians"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_rates_effective_from_key" ON "fuel_rates"("effective_from");

-- CreateIndex
CREATE INDEX "expense_periods_branch_id_period_year_period_month_idx" ON "expense_periods"("branch_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "expense_periods_technician_id_period_year_period_month_key" ON "expense_periods"("technician_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "trips_period_id_idx" ON "trips"("period_id");

-- CreateIndex
CREATE INDEX "trips_trip_date_idx" ON "trips"("trip_date");

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_default_city_id_fkey" FOREIGN KEY ("default_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_periods" ADD CONSTRAINT "expense_periods_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_periods" ADD CONSTRAINT "expense_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "expense_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_events" ADD CONSTRAINT "period_events_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "expense_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_events" ADD CONSTRAINT "period_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
