import "./RealEstate.css";
import { useMemo, useState } from "react";

function RealEstate({
  principal,
  balance,
  properties,
  loading,
  onAddProperty,
  onBuyShares,
  refreshAll,
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    total_shares: "",
    price_per_share: "",
    thumbnail_url: "",
  });
  const [buyInputs, setBuyInputs] = useState({});
  const [error, setError] = useState(null);

  const portfolio = useMemo(() => {
    const items = [];
    properties.forEach((p) => {
      const me = p.owners.find((o) => o[0].toString() === principal);
      const shares = me ? Number(me[1]) : 0;
      if (shares > 0) items.push({ id: Number(p.id), name: p.name, shares, total_shares: Number(p.total_shares) });
    });
    return items;
  }, [properties, principal]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const { name, description, total_shares, price_per_share, thumbnail_url } = form;
    if (!name || !total_shares || !price_per_share) return;
    await onAddProperty({
      name,
      description: description || "",
      total_shares: Number(total_shares),
      price_per_share: Number(price_per_share),
      thumbnail_url: thumbnail_url || "",
    });
    setForm({ name: "", description: "", total_shares: "", price_per_share: "", thumbnail_url: "" });
    await refreshAll();
  };

  const asBigInt = (v) => (typeof v === 'bigint' ? v : BigInt(v));

  const handleBuy = async (p) => {
    setError(null);

    // Check if the current user is the original creator of the property.
    // Assuming the creator is the first principal in the 'owners' array.
    if (p.owners.length > 0 && p.owners[0][0].toString() === principal) {
      setError("You cannot buy more shares of a property you created.");
      return;
    }

    const sharesStr = buyInputs[p.id] || "";
    const shares = Number(sharesStr);
    if (!shares || shares <= 0) {
      setError("Please enter a valid number of shares.");
      return;
    }
    const cost = BigInt(p.price_per_share) * BigInt(shares);

    if (cost > asBigInt(balance)) {
      setError("Not enough balance available.");
      return;
    }

    await onBuyShares({ propertyId: p.id, shares: BigInt(shares), cost });
    setBuyInputs((prev) => ({ ...prev, [p.id]: "" }));
    await refreshAll();
  };

  return (
    <div className="re-box">
      <div className="re-header">
        <h3>Real Estate</h3>
        <div className="re-balance">PK Balance: <span>{balance}</span></div>
      </div>

      {error && <div className="re-error">{error}</div>}

      <div className="re-section">
        <h4>Add Property</h4>
        <form onSubmit={handleAddSubmit} className="re-form">
          <input className="re-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required />
          <input className="re-input" value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="Thumbnail URL" />
          <textarea className="re-input" rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <div className="re-row">
            <input className="re-input" type="number" min="1" value={form.total_shares} onChange={(e) => setForm({ ...form, total_shares: e.target.value })} placeholder="Total Shares" required />
            <input className="re-input" type="number" min="1" value={form.price_per_share} onChange={(e) => setForm({ ...form, price_per_share: e.target.value })} placeholder="Price Per Share (PK)" required />
          </div>
          <button className="re-btn" type="submit" disabled={loading}>Add Property</button>
        </form>
      </div>

      <div className="re-section">
        <h4>Properties</h4>
        {properties.filter((p) => asBigInt(p.available_shares) > 0n).length === 0 ? (
          <div className="pk-empty">No properties yet.</div>
        ) : (
          <table className="re-table">
            <thead>
              <tr>
                <th>Thumb</th>
                <th>Name</th>
                <th>Price</th>
                <th>Available</th>
                <th>Your Shares</th>
                <th>Buy</th>
              </tr>
            </thead>
            <tbody>
              {properties.filter((p) => asBigInt(p.available_shares) > 0n).map((p) => {
                const my = p.owners.find((o) => o[0].toString() === principal);
                const myShares = my ? Number(my[1]) : 0;
                return (
                  <tr key={Number(p.id)}>
                    <td>
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt={p.name} className="re-thumb-sm" onError={(e) => e.currentTarget.classList.add('broken')} />
                      ) : (
                        <div className="re-thumb-sm broken" />
                      )}
                    </td>
                    <td>{p.name}</td>
                    <td><span className="accent">{asBigInt(p.price_per_share).toString()}</span></td>
                    <td>{asBigInt(p.available_shares).toString()}</td>
                    <td>{myShares}</td>
                    <td className="re-buycell">
                      <input 
                        className="re-input" 
                        type="number" 
                        min="1" 
                        value={buyInputs[p.id] || ""} 
                        onChange={(e) => {
                           setError(null);
                           setBuyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }} 
                        placeholder="#" 
                      />
                      <button 
                        className="re-btn" 
                        disabled={loading || asBigInt(p.available_shares) === 0n} 
                        onClick={() => handleBuy(p)}>
                          Buy
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {portfolio.length > 0 && (
        <div className="re-section">
          <h4>Your Holdings</h4>
          <table className="re-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Shares</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((h) => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>{h.shares}</td>
                  <td>{h.total_shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RealEstate;