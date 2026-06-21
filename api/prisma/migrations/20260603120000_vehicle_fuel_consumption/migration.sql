-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('diesel', 'petrol', 'hybrid', 'electric', 'lpg');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "fuelType" "FuelType";

-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN "fuelProductType" "FuelType";
