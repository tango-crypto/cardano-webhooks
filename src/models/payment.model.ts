import { Block } from "./block.model";

export interface Payment {
    network: string;
	transaction:  Transaction;
	inputs: Utxo[];
	outputs: Utxo[];
}

export interface Transaction {
    id?: number;
    hash: string;
    block_id?: number;
    block_index?: number;
    out_sum: number;
    fee: number;
    deposit?: number;
    size: number;
    invalid_before?: number;
    invalid_hereafter?: number;
    valid_contract?: boolean;
    script_size?: number;
    mint?: any;
    metadata?: any;
    block?: Block;
}

export interface Utxo {
    hash: string;
    index: number;
    address: string;
    value: number;
    assets?: Asset[];
    datum?: { hash? :string, value_raw?: string, value?: any };
}

export interface Asset {
    policy_id: string;
    asset_name: string;
    asset_name_label?: number;
    quantity: number;
    fingerprint?: string;
    owner?: string;
    metadata?: Metadata[];
}

export interface Metadata {
    label: string | number;
    json: any;
}