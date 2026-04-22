// OpenClaw prepaid ledger management for 0G Compute micropayments.
import { getBroker } from "./zg.core";

const TOPUP_AMOUNT = 0.05; // OG
const MIN_BALANCE = 0.01; // OG — top up when below

export async function ensureLedgerFunded(): Promise<{
  balanceOG: number;
  toppedUp: boolean;
}> {
  const broker = await getBroker();
  let toppedUp = false;
  let balanceOG = 0;

  try {
    const ledger = await broker.ledger.getLedger();
    // ledger balance is typically a BigInt in wei-equivalent
    const raw = (ledger?.totalBalance ?? ledger?.balance ?? 0n) as bigint | number;
    const asBig = typeof raw === "bigint" ? raw : BigInt(raw);
    balanceOG = Number(asBig) / 1e18;
  } catch {
    // No ledger account yet — create one via depositFund
    await broker.ledger.addLedger(TOPUP_AMOUNT);
    toppedUp = true;
    balanceOG = TOPUP_AMOUNT;
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
