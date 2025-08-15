import { AuthClient } from "@dfinity/auth-client";

export async function login(): Promise<{ identity: any; principalText: string }> {
  const authClient = await AuthClient.create();
  return new Promise((resolve, reject) => {
    authClient.login({
      identityProvider: "http://127.0.0.1:4943/?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai", // local II if you deploy it; replace in prod
      onSuccess: async () => {
        const identity = authClient.getIdentity();
        resolve({ identity, principalText: identity.getPrincipal().toText() });
      },
      onError: reject
    });
  });
}
