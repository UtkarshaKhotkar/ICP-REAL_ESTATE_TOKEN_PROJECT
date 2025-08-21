import "./Send.css";
import { useState, useEffect } from "react";

function Send({
  balance,
  loading,
  setSendPrincipal,
  handleSend,
  sendPrincipal,
  sendAmount,
  setSendAmount,
}) {
  return (
    <div className="main">
      <div className="outer">
        <div className="dot"></div>
        <div className="mine-card">
          <div className="ray"></div>

          <div className="text">{balance}</div>
          <div>Balance</div>
          <img className="hand" src="./hand.png" alt="hand" />
          <img className="tokenfull" src="./PK_token.png" alt="token" />
          <div className="line topl"></div>
          <div className="line leftl"></div>
          <div className="line bottoml"></div>
          <div className="line rightl"></div>
        </div>
      </div>
      {/* input card */}
      <div className="send_input_card">
        <span className="title">
          Send <span style={{ color: "#ff9800" }}>PK</span> Tokens
        </span>
        <div className="Input">
          <span className="subtitle">
            Enter the amount of PK Tokens you want to send.
          </span>
          <form className="pk-form" onSubmit={handleSend}>
            <div className="input-container">
              <input
                min="1"
                value={sendPrincipal}
                onChange={(e) => setSendPrincipal(e.target.value)}
                type="text"
                placeholder="Receiver Principal"
              />
              <input
                type="number"
                min="1"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="Amount"
              />
              <button className="mine-button" type="submit" disabled={loading}>
                Send
              </button>
            </div>
          </form>
        </div>
        <div className="buttons"></div>
      </div>
    </div>
  );
}

export default Send;
