import { useEffect, useState } from "react";
import Nav from "./Components/Nav/Nav";
import Mine from "./Components/Mine/Mine";
import Blurs from "./Components/blurs/blurs";
import Send from "./Components/Send/Send";
import Transactions from "./Components/Transactions/Transactions";
import RealEstate from "./Components/RealEstate/RealEstate";

import "./App.css";
import { Principal } from "@dfinity/principal";
import { AuthClient } from "@dfinity/auth-client";
import { createActor } from "declarations/PK_Token_backend";
import { canisterId } from "declarations/PK_Token_backend";
import { createActor as createREActor } from "declarations/ICP_Realestate_backend";
import { canisterId as reCanisterId } from "declarations/ICP_Realestate_backend";
import Marketplace from "./Components/Marketplace/Marketplace";

const identityProvider = "https://identity.ic0.app/#authorize";

function LoadingSpinner() {
  return (
    <div className="pk-loading-overlay">
      <div className="pk-loading-spinner"></div>
      <p>Loading...</p>
    </div>
  );
}

function App() {
  const [authClient, setAuthClient] = useState(null);
  const [actor, setActor] = useState(null);
  const [reActor, setReActor] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState("Click Whoami");

  const [activeTab, setActiveTab] = useState("marketplace");
  const [balance, setBalance] = useState(0);
  const [totalSupply, setTotalSupply] = useState(0);
  const [mineAmount, setMineAmount] = useState("");
  const [mineResult, setMineResult] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendPrincipal, setSendPrincipal] = useState("");
  const [sendResult, setSendResult] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellResult, setSellResult] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    const client = await AuthClient.create();
    const identity = client.getIdentity();
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.endsWith(".localhost");

    const agentOptions = { identity };
    const actorInstance = createActor(canisterId, { agentOptions });
    const reActorInstance = createREActor(reCanisterId, { agentOptions });

    try { await actorInstance._agent.fetchRootKey(); } catch {}
    try { await reActorInstance._agent.fetchRootKey(); } catch {}

    const isAuth = await client.isAuthenticated();
    setAuthClient(client);
    setActor(actorInstance);
    setReActor(reActorInstance);
    setIsAuthenticated(isLocal ? true : isAuth);

    const ptxt = identity.getPrincipal().toText();
    setPrincipal(ptxt);
    await fetchBalance(actorInstance);
    await fetchTotalSupply(actorInstance);
    await fetchTransactions(actorInstance);
    await fetchProperties(reActorInstance);
    // Ensure real estate canister knows the token canister
    try { await reActorInstance.set_token_canister(Principal.fromText(canisterId)); } catch {}
  };

  const login = async () => {
    if (!authClient) return;
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.endsWith(".localhost");
    if (isLocal) {
      alert("Using anonymous identity in local development.");
      await initAuth();
      return;
    }
    await authClient.login({
      identityProvider,
      onSuccess: initAuth,
    });
  };

  const logout = async () => {
    if (!authClient) return;
    await authClient.logout();
    initAuth();
  };

  const whoami = async () => {
    if (!actor) return;
    setPrincipal("Loading...");
    const result = await actor.whoami();
    setPrincipal(result.toString());
  };

  const handleResult = (res, setResult) => {
    if (typeof res === "string") return setResult(res);
    if (res?.Err) return setResult(`Error: ${res.Err}`);
    if (res?.Ok) return setResult(res.Ok);
    setResult("Unknown error.");
  };

  const fetchBalance = async (a = actor) => {
    setLoading(true);
    try {
      const bal = await a.get_my_balance();
      setBalance(Number(bal));
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalSupply = async (a = actor) => {
    try {
      const supply = await a.get_total_supply();
      setTotalSupply(Number(supply));
    } catch {
      setTotalSupply(0);
    }
  };

  const fetchTransactions = async (a = actor) => {
    try {
      const txs = await a.get_my_transactions();
      setTransactions(txs.reverse());
    } catch {
      setTransactions([]);
    }
  };

  const fetchProperties = async (ra = reActor) => {
    try {
      const list = await ra.list_properties();
      setProperties(list);
    } catch {
      setProperties([]);
    }
  };

  const handleMine = async (e) => {
    e.preventDefault();
    setMineResult("");
    const amt = Number(mineAmount);
    if (amt > 0) {
      setLoading(true);
      const res = await actor.mine_tokens(amt);
      handleResult(res, setMineResult);
      await fetchBalance();
      await fetchTotalSupply();
      await fetchTransactions();
      setLoading(false);
      alert(`Successfully mined ${amt} PK Tokens!`);
    } else {
      setMineResult("Enter a valid amount.");
      alert("Please enter a valid amount to mine.");
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSendResult("");

    const amt = Number(sendAmount);

    try {
      if (sendPrincipal && amt > 0) {
        setLoading(true);

        // ✅ Trim input before converting to Principal
        const recipientPrincipal = Principal.fromText(sendPrincipal.trim());

        // ✅ Send tokens
        const res = await actor.send_tokens(recipientPrincipal, amt);

        handleResult(res, setSendResult);
        await fetchBalance();
        await fetchTransactions();
        alert(
          `Successfully sent ${amt} PK Tokens to ${recipientPrincipal.toText()}!`
        );
      } else {
        setSendResult("Enter a valid principal and amount.");
        alert("Please enter a valid principal and amount to send.");
      }
    } catch (err) {
      console.error("Send error:", err);
      setSendResult(
        "Invalid principal format. Make sure it's correct and has no extra spaces."
      );
      alert(
        "Invalid principal format. Make sure it's correct and has no extra spaces."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddProperty = async ({ name, description, total_shares, price_per_share, thumbnail_url }) => {
    const res = await reActor.add_property(name, description, BigInt(total_shares), BigInt(price_per_share), thumbnail_url);
    if (res?.Err) alert(`Error: ${res.Err}`);
    if (res?.Ok !== undefined) alert(`Property created with id ${Number(res.Ok)}`);
  };

  const handleBuyShares = async ({ propertyId, shares, cost }) => {
    // user must send PK tokens to real estate canister first
    setLoading(true);
    try {
      const recipient = Principal.fromText(reCanisterId);
      const sendRes = await actor.send_tokens(recipient, cost);
      if (sendRes?.Err) {
        alert(`Token transfer failed: ${sendRes.Err}`);
        return;
      }
      const buyRes = await reActor.buy_shares(BigInt(propertyId), shares);
      if (buyRes?.Err) {
        alert(`Buy failed: ${buyRes.Err}`);
      } else {
        alert(`Bought ${Number(shares)} shares of property ${Number(propertyId)}`);
      }
      await fetchBalance();
      await fetchTransactions();
      await fetchProperties();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <main className="pk-main">
        {loading && <LoadingSpinner />}

        <Blurs />
        {!isAuthenticated && (
          <div className="Login_container">
            <img className="logo" src="logo2.svg" alt="ICP" />
            <div className="Login_card">
              <h3>Log in</h3>
              <p className="Login_text">
                to your <span style={{ color: "#ff9800" }}>ICP</span> identity
              </p>
              <button onClick={login}>Login</button>
            </div>
          </div>
        )}
        {isAuthenticated ? (
          <>
            <Nav
              balance={balance}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              principal={principal}
              whoami={whoami}
              logout={logout}
              fetchBalance={fetchBalance}
              fetchTransactions={fetchTransactions}
            />
            {activeTab === "mine" && (
              <div className="tab-content active">
                <Mine
                  TotalSupply={totalSupply}
                  handleMine={handleMine}
                  loading={loading}
                  mineAmount={mineAmount}
                  setMineAmount={setMineAmount}
                />
              </div>
            )}

            {activeTab === "send" && (
              <div className="tab-content active">
                <Send
                  handleSend={handleSend}
                  balance={balance}
                  loading={loading}
                  setSendPrincipal={setSendPrincipal}
                  sendPrincipal={sendPrincipal}
                  sendAmount={sendAmount}
                  setSendAmount={setSendAmount}
                />
              </div>
            )}

            {activeTab === "realestate" && (
              <div className="tab-content active">
                <RealEstate
                  principal={principal}
                  balance={balance}
                  properties={properties}
                  loading={loading}
                  onAddProperty={handleAddProperty}
                  onBuyShares={handleBuyShares}
                  refreshAll={async () => { await fetchBalance(); await fetchProperties(); }}
                />
              </div>
            )}

            {activeTab === "transactions" && (
              <div className="tab-content active">
                <Transactions transactions={transactions} loading={loading} />
              </div>
            )}

            {activeTab === "marketplace" && (
              <div className="tab-content active">
                <Marketplace
                  principal={principal}
                  balance={balance}
                  properties={properties}
                  loading={loading}
                  onBuyShares={handleBuyShares}
                  refreshAll={async () => { await fetchBalance(); await fetchProperties(); }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="pk-unauthenticated-message">
            <p>Please login to access the dapp.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
