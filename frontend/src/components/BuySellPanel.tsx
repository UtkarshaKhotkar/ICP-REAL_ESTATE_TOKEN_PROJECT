import React, { useEffect, useState } from "react";
import { makeActor } from "../agent";

// Define the listing type to match your backend canister return structure
interface Listing {
  id: bigint;
  seller: any; // can be Principal or string, depending on backend
  amount: bigint;
  price_per_share_e8s: bigint;
}

export const BuySellPanel: React.FC<{ propertyId: bigint; identity?: any }> = ({ propertyId, identity }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [amount, setAmount] = useState<string>("0");
  const [price, setPrice] = useState<string>("0");

  const load = async () => {
    const actor = await makeActor(identity);
    const res = (await actor.get_listings(propertyId)) as unknown as Listing[];
    setListings(res);
  };

  useEffect(() => { load(); }, []);

  const listShares = async () => {
    const actor = await makeActor(identity);
    await actor.list_shares(propertyId, BigInt(amount), BigInt(price));
    await load();
  };

  const buy = async (id: bigint, total: bigint) => {
    const actor = await makeActor(identity);
    await actor.buy_listing(id, total);
    await load();
  };

  return (
    <div>
      <h4>Sell</h4>
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="amount" />
      <input value={price} onChange={e => setPrice(e.target.value)} placeholder="price_per_share_e8s" />
      <button onClick={listShares}>List</button>

      <h4 style={{ marginTop: 24 }}>Listings</h4>
      <ul>
        {listings.map((l) => {
          const total = BigInt(l.price_per_share_e8s.toString()) * BigInt(l.amount.toString());
          return (
            <li key={Number(l.id)}>
              #{Number(l.id)} • seller: {l.seller?.toText?.() ?? String(l.seller)} • amount: {l.amount.toString()} • pps: {l.price_per_share_e8s.toString()}
              <button onClick={() => buy(l.id, total)} style={{ marginLeft: 12 }}>
                Buy (pay {total.toString()} e8s)
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
