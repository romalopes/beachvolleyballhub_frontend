import type { ReactNode } from "react";
import EmptyState from "../EmptyState";

export interface AdminColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface AdminTableProps<T extends { id: number }> {
  data: T[];
  columns: AdminColumn<T>[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  /**
   * Optional extra action buttons rendered before Edit/Delete. Return `null`
   * for rows where no extra action applies (e.g. an Approve button only on
   * unpublished drills).
   */
  extraActions?: (row: T) => ReactNode;
}

export default function AdminTable<T extends { id: number }>({
  data,
  columns,
  loading,
  emptyTitle,
  emptyDescription,
  onEdit,
  onDelete,
  extraActions,
}: AdminTableProps<T>) {
  if (loading) return <div className="loading">Loading...</div>;

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>
                {col.label}
              </th>
            ))}
            <th className="admin-table-actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
              <td className="admin-table-actions-col">
                <div className="admin-table-actions">
                  {extraActions?.(row)}
                  <button
                    type="button"
                    className="admin-btn admin-btn-add"
                    onClick={() => onEdit(row)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-remove"
                    onClick={() => onDelete(row)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
