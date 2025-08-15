import React, { useEffect, useState } from "react";
import { makeActor } from "../agent";

interface Property {
  id: bigint;
  title: string;
  description: string;
  circulating_shares: bigint;
  total_shares: bigint;
}

export const PropertyList: React.FC = () => {
  const [items, setItems] = useState<Property[]>([]);

  useEffect(() => {
    (async () => {
      const actor = await makeActor();
      const res = await actor.list_properties(BigInt(0), BigInt(50));
      setItems(res as Property[]);
    })();
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {items.map((p) => (
        <div
          key={Number(p.id)}
          style={{
            border: "1px solid #444",
            padding: 16,
            borderRadius: 8
          }}
        >
          <h3>{p.title}</h3>
          <p>{p.description}</p>
          <small>
            ID: {Number(p.id)} • Shares: {p.circulating_shares.toString()}/
            {p.total_shares.toString()}
          </small>
        </div>
      ))}
    </div>
  );
};
