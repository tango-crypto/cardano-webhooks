import { Block } from "./block.model";

export interface Epoch {
    no: number;
    start_time: Date;
    block: Block;
}