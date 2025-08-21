import "./Marketplace.css";
import { useState } from "react";

export default function Marketplace({ principal, balance, properties, loading, onBuyShares, refreshAll }) {
  const [buyInputs, setBuyInputs] = useState({});
  const [error, setError] = useState(null);

  const asBigInt = (v) => (typeof v === 'bigint' ? v : BigInt(v));

  const handleBuy = async (p) => {
    setError(null);

    // Check if the current user is the original creator of the property
    // We assume the creator is the first owner listed.
    if (p.owners.length > 0 && p.owners[0][0].toString() === principal) {
      setError("You cannot buy shares of a property you created.");
      return;
    }

    const sharesStr = buyInputs[p.id] || "";
    const shares = Number(sharesStr);
    if (!shares || shares <= 0) {
      setError("Please enter a valid number of shares.");
      return;
    }

    const cost = asBigInt(p.price_per_share) * BigInt(shares);

    if (cost > asBigInt(balance)) {
      setError("Not enough balance available.");
      return;
    }

    await onBuyShares({ propertyId: p.id, shares: BigInt(shares), cost });
    setBuyInputs((prev) => ({ ...prev, [p.id]: "" }));
    await refreshAll();
  };

  return (
    <div className="mp-box">
      <div className="mp-header">
        <h3>Marketplace</h3>
        <div className="mp-balance">PK Balance: <span>{balance}</span></div>
      </div>
      
      {error && <div className="mp-error">{error}</div>}

      <div className="mp-grid">
        {properties.filter((p) => asBigInt(p.available_shares) > 0n).length === 0 ? (
          <div className="pk-empty">No listings available. All sold out.</div>
        ) : (
          properties.filter((p) => asBigInt(p.available_shares) > 0n).map((p) => (
            <div className="mp-card" key={Number(p.id)}>
              {p.thumbnail_url ? (
                <img className="mp-thumb" src={p.thumbnail_url} alt={p.name} onError={(e) => e.currentTarget.classList.add('broken')} />
              ) : (
                <div className="mp-thumb broken" />
              )}
              <div className="mp-body">
                <h4>{p.name}</h4>
                <p className="desc">{p.description}</p>
                <div className="meta">
                  <span>Price/Share: <b className="accent">{asBigInt(p.price_per_share).toString()}</b></span>
                  <span>Available: {asBigInt(p.available_shares).toString()}</span>
                </div>
                <div className="buy-row">
                  <input
                    className="mp-input"
                    type="number"
                    min="1"
                    value={buyInputs[p.id] || ""}
                    onChange={(e) => {
                      setError(null);
                      setBuyInputs((prev) => ({ ...prev, [p.id]: e.target.value }));
                    }}
                    placeholder="Shares"
                  />
                  <button className="mp-btn" disabled={loading || asBigInt(p.available_shares) === 0n} onClick={() => handleBuy(p)}>
                    Buy
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}