import React, { useMemo } from "react";

/** Minimal BoxProps replacement */
type BoxProps = React.HTMLAttributes<HTMLDivElement>;

type Blockchain = "Osmosis" | "Ethereum" | "Arbitrum" | "Zilliqa" | "Neo" | string;

interface WalletBalance {
  currency: string;
  amount: number;
  blockchain: Blockchain;
}

interface FormattedWalletBalance extends WalletBalance {
  formatted: string;
}

/** ---- Stubs (replace with real implementations if provided by repo) ---- */
function useWalletBalances(): WalletBalance[] {
  return [];
}

function usePrices(): Record<string, number> {
  return {};
}

function WalletRow(props: {
  amount: number;
  usdValue: number;
  formattedAmount: string;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <div>{props.formattedAmount}</div>
      <div>${props.usdValue.toFixed(2)}</div>
    </div>
  );
}
/** --------------------------------------------------------------------- */

const PRIORITY: Record<string, number> = {
  Osmosis: 100,
  Ethereum: 50,
  Arbitrum: 30,
  Zilliqa: 20,
  Neo: 20,
};

const getPriority = (blockchain: string) => PRIORITY[blockchain] ?? -99;

interface Props extends BoxProps {}

const WalletPage: React.FC<Props> = (props) => {
  const { ...rest } = props;
  const balances = useWalletBalances();
  const prices = usePrices();

  const formattedBalances: FormattedWalletBalance[] = useMemo(() => {
    return balances
      .map((b) => ({ ...b, priority: getPriority(b.blockchain) }))
      .filter((b) => b.priority > -99 && b.amount > 0)
      .sort((a, b) => b.priority - a.priority)
      .map(({ priority, ...b }) => ({
        ...b,
        formatted: b.amount.toFixed(2),
      }));
  }, [balances]);

  const rows = useMemo(() => {
    return formattedBalances.map((b) => {
      const usdValue = (prices[b.currency] ?? 0) * b.amount;
      return (
        <WalletRow
          key={`${b.blockchain}-${b.currency}`}
          amount={b.amount}
          usdValue={usdValue}
          formattedAmount={b.formatted}
        />
      );
    });
  }, [formattedBalances, prices]);

  return <div {...rest}>{rows}</div>;
};

export default WalletPage;