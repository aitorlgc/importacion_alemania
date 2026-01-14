import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type Row = {
  make: string;
  model: string;
  year: number;
  price: number;
  precio_venta_espana: number;
  beneficio_potencial: number;
};

export function loadAnalysis(): Row[] {
  const filePath = path.join(process.cwd(), "data", "analisis_arbitraje_coches_final.csv");
  const csv = fs.readFileSync(filePath, "utf8");

  const parsed = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data.map((r) => ({
    make: String(r.make ?? "").toLowerCase(),
    model: String(r.model ?? ""),
    year: Number(r.year),
    price: Number(r.price),
    precio_venta_espana: Number(r.precio_venta_espana),
    beneficio_potencial: Number(r.beneficio_potencial),
  }));

  return rows;
}
