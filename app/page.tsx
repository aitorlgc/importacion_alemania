import TableClient from "@/components/TableClient";
import { loadAnalysis } from "@/lib/loadAnalysis";

export default function Home() {
  const rows = loadAnalysis();

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>Oportunidades de importación (DE → ES)</h1>
      <p>Dashboard a partir del CSV generado por el notebook.</p>
      <TableClient rows={rows} />
    </main>
  );
}
