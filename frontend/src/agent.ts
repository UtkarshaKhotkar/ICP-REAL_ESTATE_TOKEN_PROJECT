import { HttpAgent, Actor } from "@dfinity/agent";

// During local dev use local canister ids via dfx generate OR env
const canisterId = (import.meta as any).env.VITE_PROPERTY_HUB_CANISTER_ID;

export const makeActor = async (identity?: any) => {
  const agent = new HttpAgent({ host: "http://127.0.0.1:4943", identity });
  if (import.meta.env.DEV) {
    // fetch root key in local
    await agent.fetchRootKey();
  }

  // Minimal inline IDL factory to avoid codegen for the starter
  const idlFactory = ({ IDL }: any) => {
    const Nat = IDL.Nat;
    return IDL.Service({
      whoami: IDL.Func([], [IDL.Principal], ["query"]),
      list_properties: IDL.Func([IDL.Nat64, IDL.Nat64], [IDL.Vec(IDL.Record({
        id: IDL.Nat64, title: IDL.Text, description: IDL.Text,
        metadata_uri: IDL.Text, total_shares: Nat, circulating_shares: Nat,
        admin: IDL.Principal, active: IDL.Bool
      }))], ["query"]),
      register_property: IDL.Func([IDL.Text, IDL.Text, IDL.Text, Nat], [IDL.Record({
        id: IDL.Nat64, title: IDL.Text, description: IDL.Text, metadata_uri: IDL.Text,
        total_shares: Nat, circulating_shares: Nat, admin: IDL.Principal, active: IDL.Bool
      })], []),
      mint_shares: IDL.Func([IDL.Nat64, IDL.Principal, Nat], [], []),
      balance_of: IDL.Func([IDL.Principal, IDL.Nat64], [Nat], ["query"]),
      transfer_shares: IDL.Func([IDL.Nat64, IDL.Principal, Nat], [], []),
      list_shares: IDL.Func([IDL.Nat64, Nat, IDL.Nat64], [IDL.Record({
        id: IDL.Nat64, seller: IDL.Principal, property_id: IDL.Nat64,
        amount: Nat, price_per_share_e8s: IDL.Nat64, active: IDL.Bool
      })], []),
      get_listings: IDL.Func([IDL.Nat64], [IDL.Vec(IDL.Record({
        id: IDL.Nat64, seller: IDL.Principal, property_id: IDL.Nat64,
        amount: Nat, price_per_share_e8s: IDL.Nat64, active: IDL.Bool
      }))], ["query"]),
      buy_listing: IDL.Func([IDL.Nat64, IDL.Nat], [], []),
      grant_kyc: IDL.Func([IDL.Principal], [], []),
      revoke_kyc: IDL.Func([IDL.Principal], [], []),
      claimable_dividends: IDL.Func([IDL.Nat64, IDL.Principal], [IDL.Nat], ["query"]),
      claim_dividends: IDL.Func([IDL.Nat64], [IDL.Nat], [])
    });
  };

  return Actor.createActor(idlFactory, { agent, canisterId });
};
