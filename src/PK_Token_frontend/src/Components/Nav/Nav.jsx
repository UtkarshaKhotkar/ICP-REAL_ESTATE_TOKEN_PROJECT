import { useState, useEffect } from "react";
import { PK_Token_backend } from "declarations/PK_Token_backend";
import "./Nav.css";

function Nav({
  balance,
  activeTab,
  setActiveTab,
  principal,
  logout,
  fetchBalance,
  fetchTransactions,
}) {
  const navItems = [
    { key: "mine", label: "Mine" },
    { key: "send", label: "Send" },
    { key: "realestate", label: "Real Estate" },
    { key: "marketplace", label: "Marketplace" },
    { key: "transactions", label: "Transactions" },
  ];
  const [hover, setHover] = useState(false);

  return (
    <nav className="pk-nav">
      <div className="logo-container">
        <img className="logo-pk" src="./PK_token.png" alt="token" />
        <h2 className="pk-nav-title">Token</h2>
      </div>
      <ul className="pk-nav-list">
        {navItems.map((item) => {
          const liKey = item.key;

          return (
            <li
              key={liKey}
              className={`pk-nav-item${
                activeTab === item.key ? " active" : ""
              }`}
              onClick={() => setActiveTab(item.key)}
            >
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
      <div
        className="card"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="img"></div>
        <div className="textBox">
          <div className="textContent">
            <p className="h1">Principal:</p>
            <span className="span">
              {hover ? principal : `${principal.slice(0, 11)}...`}
            </span>
          </div>
          <p className="p">
            Balance - <span style={{ color: "#ff9800" }}>{balance}</span>
          </p>
          <div className="btns">
            <button className="logout" onClick={logout}>
              Logout
            </button>
            <button
              onClick={() => {
                fetchBalance();
                fetchTransactions();
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Nav;
