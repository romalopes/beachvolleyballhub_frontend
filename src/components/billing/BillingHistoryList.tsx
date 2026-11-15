import type { BillingHistoryEntry } from "../../api";
import { formatApiDate } from "../../utils/dateFormatter";

/**
 * Subscription lifecycle history (IDENTITY-116, Phase 7).
 *
 * Rendered from the API's append-only history, so a plan change, renewal or failed
 * payment remains visible after the fact. Deliberately does not expose Stripe
 * identifiers to the customer — they are in the API payload only for support.
 */
export default function BillingHistoryList({ entries }: { entries: BillingHistoryEntry[] }) {
  return (
    <section className="detail-section">
      <h2>Subscription history</h2>
      {entries.length === 0 ? (
        <p className="empty-state">No subscription changes yet.</p>
      ) : (
        <div className="billing-history-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Plan</th>
                <th scope="col">Change</th>
                <th scope="col">Source</th>
                <th scope="col">Paid through</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatApiDate(entry.created_at)}</td>
                  <td>
                    {entry.plan?.name ?? "—"}
                    {entry.previous_plan && entry.previous_plan.slug !== entry.plan?.slug && (
                      <span className="billing-history-previous">
                        {" "}
                        from {entry.previous_plan.name}
                      </span>
                    )}
                  </td>
                  <td>{formatStatus(entry.status)}</td>
                  <td>{entry.source}</td>
                  <td>{entry.ended_at ? formatApiDate(entry.ended_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}
