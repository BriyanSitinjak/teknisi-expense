import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/server/auth/password";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL_UNPOOLED is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "KsaDev!2026";

const BRANCHES = [
  { code: "JKT", name: "Jakarta" },
  { code: "SMG", name: "Semarang" },
  { code: "SBY", name: "Surabaya" },
  { code: "BDG", name: "Bandung" },
  { code: "PLM", name: "Palembang" },
  { code: "MDN", name: "Medan" },
] as const;

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const branches = [];
  for (const branch of BRANCHES) {
    const row = await prisma.branch.upsert({
      where: { code: branch.code },
      update: { name: branch.name },
      create: branch,
    });
    branches.push(row);
  }

  const jakarta = branches.find((b) => b.code === "JKT")!;

  await prisma.user.upsert({
    where: { email: "admin@ksa.local" },
    update: {},
    create: {
      email: "admin@ksa.local",
      name: "Administrator",
      role: "admin",
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: "hr@ksa.local" },
    update: {},
    create: {
      email: "hr@ksa.local",
      name: "Staf HRD",
      role: "hr",
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: "kepala.jkt@ksa.local" },
    update: {},
    create: {
      email: "kepala.jkt@ksa.local",
      name: "Kepala Cabang Jakarta",
      role: "branch_head",
      branchId: jakarta.id,
      passwordHash,
    },
  });

  const existingRate = await prisma.fuelRate.findFirst({
    where: { effectiveFrom: new Date("2026-01-01T00:00:00.000Z") },
  });
  if (!existingRate) {
    await prisma.fuelRate.create({
      data: {
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        pricePerLiter: 10000,
        kmPerLiter: 30,
      },
    });
  }

  const cities = ["Jakarta", "Bekasi", "Karawang", "Cikarang", "Tangerang"];
  for (const name of cities) {
    const found = await prisma.city.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (!found) await prisma.city.create({ data: { name } });
  }

  const jakartaCity = await prisma.city.findFirst({ where: { name: "Jakarta" } });
  const bekasi = await prisma.city.findFirst({ where: { name: "Bekasi" } });

  const destinations = [
    { name: "Pabrik Cikarang", defaultCityId: jakartaCity?.id ?? null },
    { name: "Gudang Bekasi", defaultCityId: bekasi?.id ?? null },
    { name: "Kantor Pusat", defaultCityId: jakartaCity?.id ?? null },
  ];
  for (const dest of destinations) {
    const found = await prisma.destination.findFirst({ where: { name: dest.name } });
    if (!found) await prisma.destination.create({ data: dest });
  }

  const existingTech = await prisma.technician.findUnique({ where: { code: "JKT-001" } });
  if (!existingTech) {
    await prisma.technician.create({
      data: { code: "JKT-001", name: "Budi Santoso", branchId: jakarta.id },
    });
  }

  console.log("Seed complete.");
  console.log("  admin@ksa.local / " + SEED_PASSWORD);
  console.log("  hr@ksa.local / " + SEED_PASSWORD);
  console.log("  kepala.jkt@ksa.local / " + SEED_PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
