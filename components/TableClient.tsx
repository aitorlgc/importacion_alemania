"use client";

import { useMemo, useState } from "react";
import type { Row } from "@/lib/loadAnalysis";

export default function TableClient({ rows }: { rows: Row[] }) {
  const [marca, setMarca] = useState<string>("all");
  const [benefMin, setBenefMin] = useState<number>(5000);

  const marcas = useMemo(() => {
    const s = new Set(rows.map(r => r.make).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter(r => (marca === "all" ? true : r.make === marca))
      .filter(r => r.beneficio_potencial >= benefMin)
      .sort((a, b) => b.beneficio_potencial - a.beneficio_potencial)
      .slice(0, 50);
  }, [rows, marca, benefMin]);

  const best = filtered[0]?.beneficio_potencial ?? 0;
  const avg = filtered.length ? filtered.reduce((s, r) => s + r.beneficio_potencial, 0) / filtered.length : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label>
          Marca:&nbsp;
          <select value={marca} onChange={(e) => setMarca(e.target.value)}>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label>
          Beneficio mínimo:&nbsp;
          <input
            type="number"
            value={benefMin}
            onChange={(e) => setBenefMin(Number(e.target.value))}
            step={500}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div><b>Filas</b>: {filtered.length}</div>
        <div><b>Mejor</b>: {best.toFixed(0)} €</div>
        <div><b>Media</b>: {avg.toFixed(0)} €</div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th align="left">make</th><th align="left">model</th><th>year</th><th>price</th>
              <th>precio_venta_espana</th><th>beneficio_potencial</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #ddd" }}>
                <td>{r.make}</td>
                <td>{r.model}</td>
                <td align="right">{r.year}</td>
                <td align="right">{r.price}</td>
                <td align="right">{r.precio_venta_espana.toFixed(0)}</td>
                <td align="right">{r.beneficio_potencial.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
