export interface Delegation {
    epoch_no: number;
    slot_no: number;
    epoch_slot_no: number;
    block_no: number;
    block_hash: string;
    tx_hash: string;
    stake_address: string;
    pool: Pool;
    network: string;
}

export interface Pool {
    id: string;
    pool_id: string;
    pledge: number;
    margin: number;
    fixed_cost: number;
    active_epoch_no: number;
    url: string;
    hash: string;
    ticker: string;
    name: string;
    description: string;
    homepage: string;
}