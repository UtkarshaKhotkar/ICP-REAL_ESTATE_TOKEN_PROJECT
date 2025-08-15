import React, { useState } from "react";
import { login } from "./auth";
import { makeActor } from "./agent";
import { PropertyList } from "./components/PropertyList";
import { BuySellPanel } from "./components/BuySellPanel";

export default function App() {
  const [principal, setPrincipal] = useState<string>("");
  const [identity, setIdentity] = useState<any>(null);
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const [uri, setUri] = useState(""); const [cap, setCap] = useState("1000000");
  const [pid, setPid] = useState("0");

  const doLogin = async () => {
    const { identity, principalText } = await login();
    setIdentity(identity); setPrincipal(principalText);
  };

  const register = async () => {
    const actor = await makeActor(identity);
    await actor.register_property(title, desc, uri, BigInt(cap));
    alert("Registered.");
  };

  const grantKyc = async () => {
    const actor = await makeActor(identity);
    // in demo, grant KYC to yourself (owner-only on backend)
    await actor.grant_kyc(identity.getPrincipal());
    alert("KYC granted (if caller is owner).");
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h2>ICP Real Estate — Fractional Ownership</h2>
      <div style={{ marginBottom: 12 }}>
        {principal ? <span>Signed in: {principal}</span> : <button onClick={doLogin}>Sign in with Internet Identity</button>}
        <button onClick={grantKyc} style={{ marginLeft: 12 }}>Grant KYC (demo)</button>
      </div>

      <section style={{ border: "1px solid #333", padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <h3>Register Property (Owner/Admin)</h3>
        <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <input placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} />
        <input placeholder="Metadata URI" value={uri} onChange={e=>setUri(e.target.value)} />
        <input placeholder="Total shares cap" value={cap} onChange={e=>setCap(e.target.value)} />
        <button onClick={register}>Register</button>
      </section>

      <PropertyList />

      <section style={{ border: "1px solid #333", padding: 16, borderRadius: 8, marginTop: 24 }}>
        <h3>Trade Panel</h3>
        <input placeholder="Property ID" value={pid} onChange={e=>setPid(e.target.value)} />
        <BuySellPanel propertyId={BigInt(pid||"0")} identity={identity} />
      </section>
    </div>
  );
}
