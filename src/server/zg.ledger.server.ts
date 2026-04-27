import { getBroker } from "./zg.core.server";

// 0G testnet enforces a 3 OG minimum to create the ledger account
const INIT_AMOUNT = 3;
const TOPUP_AMOUNT = 1;
const MIN_BALANCE = 0.5;

export async function ensureLedgerFunded(): Promise<{
  balanceOG: number;
  toppedUp: boolean;
}> {
  const broker = await getBroker();
  let toppedUp = false;
  let balanceOG = 0;

  try {
    const ledger = await broker.ledger.getLedger();
    const raw = (ledger?.totalBalance ?? ledger?.balance ?? 0n) as bigint | number;
    const asBig = typeof raw === "bigint" ? raw : BigInt(raw);
    balanceOG = Number(asBig) / 1e18;
  } catch {
    await broker.ledger.addLedger(INIT_AMOUNT);
    toppedUp = true;
    balanceOG = INIT_AMOUNT;
    return { balanceOG, toppedUp };
  }

  if (balanceOG < MIN_BALANCE) {
    await broker.ledger.depositFund(TOPUP_AMOUNT);
    balanceOG += TOPUP_AMOUNT;
    toppedUp = true;
  }

  return { balanceOG, toppedUp };
}

export async function getLedgerBalanceOG(): Promise<number> {
  const broker = await getBroker();
  try {
    const ledger = await broker.ledger.getLedger();
    const raw = (ledger?.totalBalance ?? ledger?.balance ?? 0n) as bigint | number;
    const asBig = typeof raw === "bigint" ? raw : BigInt(raw);
    return Number(asBig) / 1e18;
  } catch {
    return 0;
  }
}
