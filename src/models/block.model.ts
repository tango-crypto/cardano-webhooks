export class Block {
    network: string;
    hash: string;
    epoch_no: number;
    slot_no: number;
    epoch_slot_no: number;
    block_no: number;
    previous_block: number;
    next_block: number;
    slot_leader: string;
    out_sum: number;
    fees: number;
    confirmations: number;
    size: number;
    time: string;
    tx_count: number;
    proto_major: number;
    proto_minor: number;
    vrf_key: string;
}