import { Transaction, TransactionKind } from "../models";
import { AICategorizer, LocalAICategorizer } from "./AICategorizer";
import { AppStoreState } from "../store/useAppStore";
import { v4 as uuid } from "uuid";

export interface BankTransaction {
  externalId: string;
  date: string; // ISO string
  merchant: string;
  amount: number;
  isDebit: boolean;
}

export interface BankConnector {
  isConnected: boolean;
  connect(): Promise<void>;
  fetchNewTransactions(since: string): Promise<BankTransaction[]>;
}

// ─── Mock connector (replace with real PSD2 / Open Banking) ──

export class MockBankConnector implements BankConnector {
  isConnected = false;

  async connect(): Promise<void> {
    await new Promise((r) => setTimeout(r, 500));
    this.isConnected = true;
  }

  async fetchNewTransactions(_since: string): Promise<BankTransaction[]> {
    if (!this.isConnected) return [];
    return [
      {
        externalId: uuid(),
        date: new Date().toISOString(),
        merchant: "VERO CENTAR",
        amount: 850,
        isDebit: true,
      },
      {
        externalId: uuid(),
        date: new Date(Date.now() - 3_600_000).toISOString(),
        merchant: "EVN HOME",
        amount: 2400,
        isDebit: true,
      },
    ];
  }
}

// ─── Sync service ─────────────────────────────────────────────

export class BankSyncService {
  private readonly categorizer: AICategorizer;

  constructor(
    private readonly store: AppStoreState,
    private readonly connector: BankConnector,
    categorizer?: AICategorizer
  ) {
    this.categorizer = categorizer ?? new LocalAICategorizer();
  }

  async sync(): Promise<void> {
    if (!this.connector.isConnected) {
      await this.connector.connect();
    }

    const since =
      this.store.transactions[0]?.date ?? new Date(0).toISOString();

    const bankTxs = await this.connector.fetchNewTransactions(since);

    for (const bt of bankTxs) {
      const cat = await this.categorizer.categorize(
        bt.merchant,
        "",
        this.store.categories
      );

      const t: Transaction = {
        id: uuid(),
        date: bt.date,
        merchant: bt.merchant,
        amount: bt.amount,
        kind: bt.isDebit ? TransactionKind.EXPENSE : TransactionKind.INCOME,
        categoryId: cat.categoryId,
        subcategoryId: cat.subcategoryId,
        note: "",
        source: "Банка",
      };

      this.store.addTransaction(t);
    }
  }
}