import "./Transactions.css";
import { useState, useEffect } from "react";

function Transactions({ transactions, loading }) {
  return (
    <section className="history">
      <div className="history_card">
        <h3>Transaction History</h3>
        {transactions.length === 0 ? (
          <div className="pk-empty">No transactions yet.</div>
        ) : (
          <table className="pk-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, idx) => (
                <tr key={idx}>
                  <td>{tx.tx_type}</td>
                  <td>{tx.from ? tx.from.toString() : "-"}</td>
                  <td>{tx.to ? tx.to.toString() : "-"}</td>
                  <td>{tx.amount}</td>
                  <td>
                    {new Date(Number(tx.timestamp) / 1000000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default Transactions;
