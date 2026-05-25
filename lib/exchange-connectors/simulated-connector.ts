import { BaseExchangeConnector, type ExchangeCredentials } from "./base-connector";
import { v4 as uuidv4 } from "uuid";

// Minimal simulated connector used for tests when external exchange calls are blocked.
// It fakes immediate fills and basic position responses so the live pipeline exercises
// order placement, SL/TP placement, and reconcile paths without network access.

export class SimulatedConnector extends BaseExchangeConnector {
  constructor(credentials: ExchangeCredentials, exchange: string = "simulated") {
    super(credentials, exchange)
  }

  getCapabilities(): string[] {
    return ["futures", "perpetual_futures", "leverage"]
  }

  async testConnection(): Promise<any> {
    return { success: true, balance: 1000, capabilities: this.getCapabilities(), logs: [] }
  }

  async getBalance(): Promise<any> {
    return { success: true, balance: 1000, balances: [{ asset: "USDT", free: 1000, locked: 0, total: 1000 }] }
  }

  async placeOrder(symbol: string, side: "buy" | "sell", quantity: number): Promise<{ success: boolean; orderId?: string; filledQty?: number; filledPrice?: number; error?: string }> {
    const orderId = `sim-${Date.now()}-${Math.floor(Math.random() * 100000)}`
    // Simulate immediate full fill at a synthetic price
    const filledPrice = 1.0
    return { success: true, orderId, filledQty: quantity, filledPrice }
  }

  async placeStopOrder(symbol: string, side: "buy" | "sell", quantity: number, price: number, type: string): Promise<string | null> {
    return `sim-stop-${Date.now()}`
  }

  async getOrder(symbol: string, orderId: string): Promise<any> {
    return { success: true, orderId, status: "filled", filledQty: 0, avgPrice: 0 }
  }

  async getPosition(symbol: string): Promise<any> {
    return { size: 0, entryPrice: 0 }
  }

  async getPositions(): Promise<any[]> {
    return []
  }

  async closePosition(symbol: string, direction: string): Promise<{ success: boolean; error?: string }> {
    return { success: true }
  }

  async cancelOrder(symbol: string, orderId: string): Promise<{ success: boolean }> {
    return { success: true }
  }

  async setLeverage(_symbol: string, _lev: number): Promise<void> {
    return
  }

  async setMarginType(_symbol: string, _type: string): Promise<void> {
    return
  }
}
