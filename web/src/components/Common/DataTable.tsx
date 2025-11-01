import React from 'react';
import { TablaParsed } from '../../../../sdk/src';

interface DataTableProps {
    table: TablaParsed;
}

export const DataTable: React.FC<DataTableProps> = ({ table }) => {
    if (!table || table.rows.length === 0) return <div className="empty-state">No data</div>;
    
    return (
        <div className="table-container">
            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>{table.headers.map((h, i) => (<th key={i}>{h}</th>))}</tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, ri) => (
                            <tr key={ri}>{table.headers.map((h, ci) => (<td key={ci}>{row[h] || ''}</td>))}</tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
