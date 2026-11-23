import { createFileRoute, Link } from "@tanstack/react-router";
import { CategorySection, SubCategory } from "@/avatar/CategorySection";
import {
  MANUAL_CATEGORIES,
  MANUAL_FRONT,
  MANUAL_STATE_LABEL,
  type ManualEntry,
} from "@/avatar/manualContent";

/**
 * THE MASTER MANUAL (owner order 2026-11-23): a whole manual inside
 * the system — how to operate everything, where everything lives,
 * and the rebuild chapter for if the world goes dark. Organized by
 * categories with subcategories (the Organization Law), big readable
 * type, plain words. The words live in avatar/manualContent.ts —
 * every future build adds its entry there as part of done.
 *
 * The header carries the standing "← Augie" exit back to the stage,
 * the same control every full-page room has.
 */
export const Route = createFileRoute("/manual")({
  component: MasterManualPage,
});

const STATE_COLOR: Record<ManualEntry["state"], string> = {
  live: "#7bc47f",
  building: "#e0b64f",
  design: "#9fb0c9",
  gap: "#e07a5f",
};

function EntryBlock({ entry }: { entry: ManualEntry }) {
  return (
    <article style={{ margin: "0 0 1.4rem" }}>
      <p style={{ margin: "0 0 0.3rem" }}>
        <span
          style={{
            color: STATE_COLOR[entry.state],
            border: `1px solid ${STATE_COLOR[entry.state]}`,
            borderRadius: "999px",
            padding: "2px 10px",
            fontSize: "0.85rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {MANUAL_STATE_LABEL[entry.state]}
        </span>
      </p>
      <p style={{ margin: "0 0 0.6rem", lineHeight: 1.55 }}>{entry.what}</p>
      {entry.steps && entry.steps.length > 0 && (
        <ol style={{ margin: "0 0 0.6rem", paddingLeft: "1.5rem", lineHeight: 1.55 }}>
          {entry.steps.map((step) => (
            <li key={step.slice(0, 48)} style={{ marginBottom: "0.3rem" }}>
              {step}
            </li>
          ))}
        </ol>
      )}
      {entry.table && (
        <div style={{ overflowX: "auto", margin: "0 0 0.6rem" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: "1rem",
              lineHeight: 1.45,
            }}
          >
            <thead>
              <tr>
                {entry.table.head.map((cell) => (
                  <th
                    key={cell}
                    style={{
                      textAlign: "left",
                      borderBottom: "2px solid #d4af37",
                      padding: "0.45rem 0.6rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entry.table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td
                      key={`${row[0]}-${i}`}
                      style={{
                        borderBottom: "1px solid #3a4763",
                        padding: "0.45rem 0.6rem",
                        verticalAlign: "top",
                        fontWeight: i === 0 ? 700 : 400,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entry.where && (
        <p style={{ margin: "0 0 0.4rem", color: "#9fb0c9" }}>
          <strong>Where it lives:</strong> {entry.where}
        </p>
      )}
      {entry.note && (
        <p style={{ margin: 0, color: "#e0cf9f" }}>
          <strong>Honest note:</strong> {entry.note}
        </p>
      )}
    </article>
  );
}

function MasterManualPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#0d1117",
        color: "#e6e6e6",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "0.6rem 1rem",
          borderBottom: "2px solid #d4af37",
          background: "#101623",
          flex: "0 0 auto",
        }}
      >
        <Link
          to="/avatar"
          style={{
            color: "#9fb0c9",
            textDecoration: "none",
            border: "1px solid #3a4763",
            padding: "6px 10px",
            borderRadius: "999px",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          ← Augie
        </Link>
        <h1 style={{ fontSize: "19px", margin: 0 }}>Master Manual</h1>
      </header>

      <main
        style={{
          flex: 1,
          overflowY: "auto",
          width: "100%",
          maxWidth: "62rem",
          margin: "0 auto",
          padding: "1.25rem 1rem 3rem",
          fontSize: "1.125rem",
        }}
      >
        <p style={{ lineHeight: 1.55, marginTop: 0 }}>{MANUAL_FRONT.promise}</p>
        <p style={{ lineHeight: 1.55, fontWeight: 700, color: "#e0cf9f" }}>
          {MANUAL_FRONT.standingRule}
        </p>
        <p style={{ lineHeight: 1.55 }}>{MANUAL_FRONT.truthMarks}</p>
        <p style={{ lineHeight: 1.55 }}>
          The same manual rides the offline vault as a document (MASTER-MANUAL.md), so it survives
          with the vault even if this app is down.
        </p>

        {MANUAL_CATEGORIES.map((category, index) => (
          <CategorySection
            key={category.id}
            title={category.title}
            hint={category.hint}
            defaultOpen={index === 0}
          >
            {category.entries.map((entry) => (
              <SubCategory key={entry.id} title={entry.title}>
                <EntryBlock entry={entry} />
              </SubCategory>
            ))}
          </CategorySection>
        ))}
      </main>
    </div>
  );
}
