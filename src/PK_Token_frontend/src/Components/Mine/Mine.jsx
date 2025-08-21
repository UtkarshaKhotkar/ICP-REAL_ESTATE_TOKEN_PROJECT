import "./Mine.css";

function Mine({ TotalSupply, handleMine, loading, mineAmount, setMineAmount }) {
  return (
    <div className="main">
      <div className="outer">
        <div className="dot"></div>
        <div className="mine-card">
          <div className="ray"></div>

          <div className="text">{TotalSupply}</div>
          <div>Mined</div>
          <img className="pickaxe" src="./pickaxe.png" alt="pickaxe" />
          <img className="token" src="./PK_token_half.png" alt="token" />
          <div className="line topl"></div>
          <div className="line leftl"></div>
          <div className="line bottoml"></div>
          <div className="line rightl"></div>
        </div>
      </div>
      {/* input card */}
      <div className="input_card">
        <span className="title">
          Mine <span style={{ color: "#ff9800" }}>PK</span> Tokens
        </span>
        <div className="Input">
          <span className="subtitle">
            Enter the amount of PK Tokens you want to mine.
          </span>
          <form className="pk-form" onSubmit={handleMine}>
            <div className="input-container">
              <input
                min="1"
                value={mineAmount}
                onChange={(e) => setMineAmount(e.target.value)}
                type="text"
                placeholder="Number of PK's"
              />
              <button className="mine-button" type="submit" disabled={loading}>
                Mine
              </button>
            </div>
          </form>
        </div>
        <div className="buttons"></div>
      </div>
    </div>
  );
}

export default Mine;
