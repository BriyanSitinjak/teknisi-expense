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

function periodStamp(month: number, year: number, separator: "/" | "-") {
  return `${String(month).padStart(2, "0")}${separator}${year}`;
}

function formatMoney(row: ExcelJS.Row, columns: number[]) {
  for (const col of columns) row.getCell(col).numFmt = CURRENCY;
}

function tripTotals(trips: Array<{ fuelCost: number; tollAmount: number; parkingAmount: number; mealAmount: number; totalAmount: number }>) {
  return trips.reduce(
    (sum, trip) => ({
      fuel: sum.fuel + trip.fuelCost,
      tollPark: sum.tollPark + trip.tollAmount + trip.parkingAmount,
      meal: sum.meal + trip.mealAmount,
      total: sum.total + trip.totalAmount,
    }),
    { fuel: 0, tollPark: 0, meal: 0, total: 0 },
  );
}

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
    const { fuel, tollPark, meal, total } = tripTotals(period.trips);
    const current = branchTotals.get(period.branch.code) ?? { trips: 0, fuel: 0, tollPark: 0, meal: 0, total: 0 };
    current.trips += period.trips.length;
    current.fuel += fuel;
    current.tollPark += tollPark;
    current.meal += meal;
    current.total += total;
    branchTotals.set(period.branch.code, current);

    const row = rekap.addRow({
      period: periodStamp(period.periodMonth, period.periodYear, "/"),
      code: period.technician.code,
      name: period.technician.name,
      branch: period.branch.code,
      trips: period.trips.length,
      fuel,
      tollPark,
      meal,
      total,
    });
    formatMoney(row, [6, 7, 8, 9]);
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
    formatMoney(row, [6, 7, 8, 9]);
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
    const periodLabel = periodStamp(period.periodMonth, period.periodYear, "-");
    const sheet = workbook.addWorksheet(sheetName(period.technician.code, periodLabel, usedNames));
    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").value = "BIAYA OPERASIONAL TEKNISI";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.mergeCells("A2:J2");
    sheet.getCell("A2").value =
      `${period.technician.code} — ${period.technician.name}  |  ${period.branch.name}  |  ${periodStamp(period.periodMonth, period.periodYear, "/")}`;

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
      formatMoney(row, [7, 8, 9]);
      [4, 5, 6, 7, 8, 9].forEach((col) => {
        row.getCell(col).alignment = { horizontal: "right" };
      });
    }

    const totals = tripTotals(period.trips);

    const sub = sheet.addRow(["", "", "", "", "", "Sub Total", totals.fuel, totals.tollPark, totals.meal, ""]);
    sub.font = { bold: true };
    formatMoney(sub, [7, 8, 9]);

    const grandRow = sheet.addRow(["", "", "", "", "", "Grand Total", totals.total, "", "", ""]);
    grandRow.font = { bold: true };
    formatMoney(grandRow, [7]);

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
