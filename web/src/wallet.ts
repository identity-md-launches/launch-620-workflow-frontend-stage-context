import { useEffect, useState } from "react";
import { isAddress, type Address, type EIP1193Provider } from "viem";
import { errorMessage, type Runtime } from "./chain";
export type Provider = EIP1193Provider;
type Wallet = { id: string; name: string; provider: Provider };
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export function useWallet() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selected, setSelected] = useState("");
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<Provider>();
  useEffect(() => {
    const announce = (event: Event) => {
      const { detail } = event as CustomEvent<{
        info: { uuid: string; name: string };
        provider: Provider;
      }>;
      if (!detail?.provider?.request || !detail.info?.uuid) return;
      setWallets((list) =>
        list.some((w) => w.id === detail.info.uuid)
          ? list
          : [
              ...list,
              {
                id: detail.info.uuid,
                name: detail.info.name.slice(0, 60),
                provider: detail.provider,
              },
            ],
      );
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (window.ethereum)
      setWallets((list) =>
        list.some((w) => w.id === "injected")
          ? list
          : [
              ...list,
              {
                id: "injected",
                name: "Browser wallet",
                provider: window.ethereum!,
              },
            ],
      );
    return () =>
      window.removeEventListener("eip6963:announceProvider", announce);
  }, []);
  useEffect(() => {
    if (!provider) return;
    const accountsChanged = (accounts: string[]) => {
      setAccount(
        accounts[0] && isAddress(accounts[0]) ? accounts[0] : undefined,
      );
      setError("");
    };
    const chainChanged = (id: string) => setChainId(Number(id));
    const disconnected = () => {
      setAccount(undefined);
      setChainId(undefined);
      setProvider(undefined);
    };
    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    provider.on("disconnect", disconnected);
    return () => {
      provider.removeListener("accountsChanged", accountsChanged);
      provider.removeListener("chainChanged", chainChanged);
      provider.removeListener("disconnect", disconnected);
    };
  }, [provider]);
  async function connect() {
    const wallet = wallets.find((w) => w.id === selected) || wallets[0];
    if (!wallet) {
      setError(
        "No browser wallet detected. Open this site in an Ethereum wallet browser or install an EIP-1193 compatible browser wallet, then reload.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const accounts = await wallet.provider.request({
        method: "eth_requestAccounts",
      });
      const id = await wallet.provider.request({ method: "eth_chainId" });
      if (!accounts[0] || !isAddress(accounts[0]))
        throw Error("The wallet returned no account. Unlock it and try again.");
      setProvider(wallet.provider);
      setAccount(accounts[0]);
      setChainId(Number(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function switchChain(r: Runtime) {
    if (!provider) return;
    setBusy(true);
    setError("");
    try {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${r.config.chainId.toString(16)}` }],
        });
      } catch (e) {
        if ((e as { code?: number }).code !== 4902 || !r.config.walletAddChain)
          throw e;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [r.config.walletAddChain],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${r.config.chainId.toString(16)}` }],
        });
      }
      setChainId(Number(await provider.request({ method: "eth_chainId" })));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return {
    wallets,
    selected,
    setSelected,
    provider,
    account,
    chainId,
    error,
    busy,
    connect,
    switchChain,
    disconnect: () => {
      setProvider(undefined);
      setAccount(undefined);
      setChainId(undefined);
      setError("");
    },
  };
}
export type WalletState = ReturnType<typeof useWallet>;
