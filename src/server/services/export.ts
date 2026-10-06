import ExcelJS from "exceljs";
import { prisma } from "@/server/db/prisma";
import type { SessionUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { formatTripKeterangan } from "@/lib/format";
import { formatIsoDate } from "@/server/openapi";

function sheetName(code: string, name: string, used: Set<string>) {
  const base = `${code} ${name}`.replace(/[:\\/?*\[\]]/g, " ").slice(0, 31).trim() || "Teknisi";
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${i}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    i += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function applyPrintSetup(sheet: ExcelJS.Worksheet, lastRow: number) {
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    printArea: `A1:J${lastRow}`,
    printTitlesRow: "3:3",
  };
  sheet.headerFooter = {
    oddFooter: "&LDicetak &D &T&RHalaman &P dari &N",
  };
}

const CURRENCY = "#,##0";

export async function exportWorkbook(user: SessionUser, branchId?: string) {
  let scopedBranchId = branchId;

  if (user.role === "branch_head") {
    if (branchId && branchId !== user.branchId) {
      throw new NotFoundError();
    }
    scopedBranchId = user.branchId ?? undefined;
    if (!scopedBranchId) {
      throw new NotFoundError();
    }
  }

  if (scopedBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: scopedBranchId },
    });
    if (!branch) {
      throw new NotFoundError();
    }
  }

  const periods = await prisma.expensePeriod.findMany({
    where: {
      ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
    },
    include: {
      technician: true,
      branch: true,
      trips: {
        include: { city: true, destination: true },
        orderBy: [{ tripDate: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [
      { periodYear: "desc" },
      { periodMonth: "desc" },
      { branch: { code: "asc" } },
      { technician: { name: "asc" } },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "teknisi-expense";
  workbook.created = new Date();

  const rekap = workbook.addWorksheet("REKAP");
  rekap.columns = [
    { header: "PERIODE", key: "period", width: 12 },
    { header: "KODE", key: "code", width: 12 },
    { header: "TEKNISI", key: "name", width: 28 },
    { header: "CABANG", key: "branch", width: 16 },
    { header: "JUMLAH TRIP", key: "trips", width: 14 },
    { header: "BBM", key: "fuel", width: 14 },
    { header: "TOLL DAN PARKIR", key: "tollPark", width: 18 },
    { header: "MAKAN", key: "meal", width: 14 },
    { header: "TOTAL", key: "total", width: 14 },
  ];

  rekap.spliceRows(1, 0, ["REKAP BIAYA OPERASIONAL TEKNISI"]);
  rekap.mergeCells("A1:I1");
  rekap.getRow(1).font = { bold: true, size: 14 };

  const branchTotals = new Map<string, { trips: number; fuel: number; tollPark: number; meal: number; total: number }>();

  for (const period of periods) {
    const fuel = period.trips.reduce((sum, trip) => sum + trip.fuelCost, 0);
    const tollPark = period.trips.reduce((sum, trip) => sum + trip.tollAmount + trip.parkingAmount, 0);
    const meal = period.trips.reduce((sum, trip) => sum + trip.mealAmount, 0);
    const total = period.trips.reduce((sum, trip) => sum + trip.totalAmount, 0);
    const current = branchTotals.get(period.branch.code) ?? { trips: 0, fuel: 0, tollPark: 0, meal: 0, total: 0 };
    current.trips += period.trips.length;
    current.fuel += fuel;
    current.tollPark += tollPark;
    current.meal += meal;
    current.total += total;
    branchTotals.set(period.branch.code, current);

    const row = rekap.addRow({
      period: `${String(period.periodMonth).padStart(2, "0")}/${period.periodYear}`,
      code: period.technician.code,
      name: period.technician.name,
      branch: period.branch.code,
      trips: period.trips.length,
      fuel,
      tollPark,
      meal,
      total,
    });
    for (const col of [6, 7, 8, 9]) {
      row.getCell(col).numFmt = CURRENCY;
    }
  }

  rekap.addRow([]);
  for (const [code, totals] of branchTotals) {
    const row = rekap.addRow({
      period: "",
      code: "",
      name: `SUBTOTAL ${code}`,
      branch: code,
      trips: totals.trips,
      fuel: totals.fuel,
      tollPark: totals.tollPark,
      meal: totals.meal,
      total: totals.total,
    });
    row.font = { bold: true };
    for (const col of [6, 7, 8, 9]) {
      row.getCell(col).numFmt = CURRENCY;
    }
  }

  rekap.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    printArea: `A1:I${rekap.rowCount}`,
    printTitlesRow: "2:2",
  };
  rekap.headerFooter = { oddFooter: "&LDicetak &D &T&RHalaman &P dari &N" };

  const usedNames = new Set<string>(["rekap"]);

  for (const period of periods) {
    const periodLabel = `${String(period.periodMonth).padStart(2, "0")}-${period.periodYear}`;
    const sheet = workbook.addWorksheet(sheetName(period.technician.code, periodLabel, usedNames));
    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").value = "BIAYA OPERASIONAL TEKNISI";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.mergeCells("A2:J2");
    sheet.getCell("A2").value =
      `${period.technician.code} — ${period.technician.name}  |  ${period.branch.name}  |  ${String(period.periodMonth).padStart(2, "0")}/${period.periodYear}`;

    const header = sheet.addRow([
      "TANGGAL",
      "TUJUAN",
      "KOTA",
      "KM AWAL",
      "KM AKHIR",
      "JARAK",
      "BBM",
      "TOLL DAN PARKIR",
      "MAKAN",
      "KETERANGAN",
    ]);
    header.font = { bold: true };
    header.alignment = { vertical: "middle", wrapText: true };

    sheet.columns = [
      { width: 12 },
      { width: 22 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 10 },
      { width: 14 },
      { width: 18 },
      { width: 14 },
      { width: 28 },
    ];

    for (const trip of period.trips) {
      const row = sheet.addRow([
        formatIsoDate(trip.tripDate),
        trip.destination.name,
        trip.city.name,
        trip.odoStart,
        trip.odoEnd,
        trip.distanceKm,
        trip.fuelCost,
        trip.tollAmount + trip.parkingAmount,
        trip.mealAmount,
        formatTripKeterangan(trip.notes, trip.extraTitle, trip.extraValue),
      ]);
      row.getCell(1).numFmt = "DD/MM/YYYY";
      row.getCell(7).numFmt = CURRENCY;
      row.getCell(8).numFmt = CURRENCY;
      row.getCell(9).numFmt = CURRENCY;
      [4, 5, 6, 7, 8, 9].forEach((col) => {
        row.getCell(col).alignment = { horizontal: "right" };
      });
    }

    const subFuel = period.trips.reduce((sum, trip) => sum + trip.fuelCost, 0);
    const subToll = period.trips.reduce((sum, trip) => sum + trip.tollAmount + trip.parkingAmount, 0);
    const subMeal = period.trips.reduce((sum, trip) => sum + trip.mealAmount, 0);
    const grand = period.trips.reduce((sum, trip) => sum + trip.totalAmount, 0);

    const sub = sheet.addRow(["", "", "", "", "", "Sub Total", subFuel, subToll, subMeal, ""]);
    sub.font = { bold: true };
    sub.getCell(7).numFmt = CURRENCY;
    sub.getCell(8).numFmt = CURRENCY;
    sub.getCell(9).numFmt = CURRENCY;

    const grandRow = sheet.addRow(["", "", "", "", "", "Grand Total", grand, "", "", ""]);
    grandRow.font = { bold: true };
    grandRow.getCell(7).numFmt = CURRENCY;

    sheet.addRow([]);
    sheet.addRow(["Pemeriksa", "", "", "", "", "", "Staf HRD GA"]);
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow(["( ............................ )", "", "", "", "", "", "( ............................ )"]);

    applyPrintSetup(sheet, sheet.rowCount);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const branchCode = scopedBranchId
    ? (await prisma.branch.findUnique({ where: { id: scopedBranchId } }))?.code ?? "ALL"
    : "ALL";
  const filename = `Biaya-Operasional-Teknisi-${branchCode}.xlsx`;

  return { buffer: Buffer.from(buffer), filename };
}
